import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { QrCodeComponent } from 'ng-qrcode';

import { TableService } from '../../../core/api/table/table.service';
import { StatutTable, TableSalle } from '../../../core/api/table/table.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';

const STATUTS: { value: StatutTable; label: string }[] = [
  { value: 'libre', label: 'Libre' },
  { value: 'occupee', label: 'Occupée' },
  { value: 'reservee', label: 'Réservée' },
  { value: 'a_debarrasser', label: 'À débarrasser' },
];

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [ReactiveFormsModule, QrCodeComponent, SiteRequisComponent],
  templateUrl: './tables.page.html',
  styleUrl: './tables.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesPage implements OnInit {
  private readonly tableService = inject(TableService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly pdfService = inject(PdfService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuts = STATUTS;
  readonly statutLabel: Record<StatutTable, string> = {
    libre: 'Libre',
    occupee: 'Occupée',
    reservee: 'Réservée',
    a_debarrasser: 'À débarrasser',
  };

  // Tous les PDV chargés, puis restreints au site global sélectionné.
  private readonly allPdvs = signal<PointDeVente[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly pdvs = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);
  readonly tables = signal<TableSalle[]>([]);
  readonly loading = signal(true);
  readonly loadingTables = signal(false);

  readonly drawerOpen = signal(false);
  readonly editingTable = signal<TableSalle | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deleting = signal(false);

  // QR du menu public (côté admin uniquement).
  readonly qrBusy = signal(false);
  readonly plancheBusy = signal(false);
  readonly lienCopie = signal(false);

  readonly selectedPdv = computed(
    () => this.pdvs().find((p) => p.id === this.selectedPdvId()) ?? null,
  );

  readonly form = this.fb.nonNullable.group({
    numero: ['', [Validators.required, Validators.maxLength(50)]],
    capacite: [2, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    // Les statuts de table changent au fil du service, y compris depuis un
    // autre poste. En pause tiroir ouvert pour ne pas écraser une saisie.
    rafraichissementAuto(
      30_000,
      () => this.rechargerTables(),
      () => this.drawerOpen(),
    );

    // Le contenu du tiroir appartient au site quitté : changer de périmètre le
    // ferme plutôt que d'enregistrer une saisie sur le mauvais site.
    effect(() => {
      this.selectedSite.epoch();
      this.drawerOpen.set(false);
    });

    // Aligne le PDV sélectionné sur le site global : conserve le choix s'il
    // appartient encore au site courant, sinon retient le premier PDV du site.
    effect(() => {
      const list = this.pdvs();
      const current = untracked(() => this.selectedPdvId());
      if (current !== null && list.some((p) => p.id === current)) {
        return;
      }
      const next = list[0]?.id ?? null;
      this.selectedPdvId.set(next);
      if (next !== null) {
        this.loadTables(next);
      } else {
        this.tables.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.pdvService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pdvs) => {
          this.allPdvs.set(pdvs);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selectPdv(id: number): void {
    this.selectedPdvId.set(id);
    this.loadTables(id);
  }

  /** Recharge silencieusement le PDV courant (pas d'état « chargement »). */
  private rechargerTables(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId !== null) {
      this.loadTables(pdvId, { discret: true });
    }
  }

  private loadTables(id: number, options: { discret?: boolean } = {}): void {
    if (options.discret !== true) {
      this.loadingTables.set(true);
    }
    this.tableService
      .list(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tables) => {
          this.tables.set(
            [...tables].sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })),
          );
          this.loadingTables.set(false);
        },
        error: () => this.loadingTables.set(false),
      });
  }

  onPdvChange(value: string): void {
    this.selectPdv(Number(value));
  }

  openCreate(): void {
    this.editingTable.set(null);
    this.form.reset({ numero: '', capacite: 2 });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(table: TableSalle): void {
    this.editingTable.set(table);
    this.form.reset({ numero: table.numero, capacite: table.capacite });
    this.formError.set(null);
    this.lienCopie.set(false);
    this.drawerOpen.set(true);
  }

  // ─────────────────────────── QR du menu public ───────────────────────────

  /** Chevalet A6 de la table, à poser dessus. */
  telechargerQr(table: TableSalle): void {
    if (this.qrBusy()) {
      return;
    }
    this.qrBusy.set(true);
    this.pdfService
      .qrTable(table.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          ouvrirPdfDansOnglet(blob, `qr-table-${table.numero}.pdf`);
          this.qrBusy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.qrBusy.set(false);
          alert(apiErrorMessage(err, 'Génération du QR impossible.'));
        },
      });
  }

  /** Planche A4 de toutes les tables du PDV, pour équiper la salle en une impression. */
  imprimerPlanche(): void {
    const pdv = this.selectedPdv();
    if (!pdv || this.plancheBusy()) {
      return;
    }
    this.plancheBusy.set(true);
    this.pdfService
      .qrPlanchePointDeVente(pdv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          ouvrirPdfDansOnglet(blob, `qr-planche-${pdv.nom}.pdf`);
          this.plancheBusy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.plancheBusy.set(false);
          alert(apiErrorMessage(err, 'Génération de la planche impossible.'));
        },
      });
  }

  /**
   * Régénère le jeton : opération destructrice pour les QR déjà collés en
   * salle, d'où la confirmation explicite.
   */
  regenererToken(table: TableSalle): void {
    const confirme = confirm(
      `Régénérer le QR de la table ${table.numero} ?\n\n` +
        'Les QR déjà imprimés pour cette table cesseront de fonctionner et devront être remplacés.',
    );
    if (!confirme) {
      return;
    }

    this.tableService
      .regenererToken(table.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.tables.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          this.editingTable.set(updated);
          this.lienCopie.set(false);
        },
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Régénération impossible.')),
      });
  }

  copierLien(table: TableSalle): void {
    const url = table.menu_url;
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        this.lienCopie.set(true);
        setTimeout(() => this.lienCopie.set(false), 2000);
      },
      () => alert('Copie impossible. Sélectionnez le lien manuellement.'),
    );
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  save(): void {
    const pdvId = this.selectedPdvId();
    if (this.form.invalid || this.saving() || pdvId === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const value = this.form.getRawValue();
    const editing = this.editingTable();

    const request$ = editing
      ? this.tableService.update(editing.id, value)
      : this.tableService.create({ ...value, point_de_vente_id: pdvId });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          this.tables.update((list) => list.map((t) => (t.id === saved.id ? saved : t)));
        } else {
          this.tables.update((list) => [...list, saved]);
        }
        this.saving.set(false);
        this.drawerOpen.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err, 'Enregistrement impossible.'));
      },
    });
  }

  changerStatut(table: TableSalle, statut: StatutTable): void {
    if (table.statut === statut) {
      return;
    }
    this.tableService
      .changerStatut(table.id, statut)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.tables.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          const editing = this.editingTable();
          if (editing && editing.id === updated.id) {
            this.editingTable.set(updated);
          }
        },
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Changement impossible.')),
      });
  }

  delete(table: TableSalle): void {
    if (!confirm(`Supprimer la table ${table.numero} ?`)) {
      return;
    }
    this.deleting.set(true);
    this.tableService
      .delete(table.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tables.update((list) => list.filter((t) => t.id !== table.id));
          this.deleting.set(false);
          this.drawerOpen.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.deleting.set(false);
          alert(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}
