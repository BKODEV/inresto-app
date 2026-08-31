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
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { QrCodeComponent } from 'ng-qrcode';

import { TableService } from '../../../core/api/table/table.service';
import { StatutTable, TableLotLigne, TableSalle } from '../../../core/api/table/table.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AuthService } from '../../../core/auth/auth.service';
import { LOT_MAX, genererNumeros, indexesEnDoublon } from './serie-tables';
import { AlerteService } from '../../../core/alertes/alerte.service';

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
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

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
  readonly canCreate = computed(() => this.auth.hasPermission('table.create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('table.update'));
  readonly canDelete = computed(() => this.auth.hasPermission('table.delete'));

  readonly selectedPdvId = signal<number | null>(null);
  readonly tables = signal<TableSalle[]>([]);
  // Les archivées ne sont chargées que sur demande : elles ne font plus partie
  // de la salle, on ne les affiche que pour en réactiver une.
  readonly afficherArchivees = signal(false);
  readonly archiving = signal(false);
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

  // ── Création en série ──────────────────────────────────────────────────
  readonly lotMax = LOT_MAX;
  readonly lotDrawerOpen = signal(false);
  readonly lotSaving = signal(false);
  readonly lotError = signal<string | null>(null);
  readonly lotLineErrors = signal<Record<number, string>>({});
  readonly lotLignes = signal<FormGroup[]>([]);

  /**
   * Lignes ajoutées à la main : elles vivent après la série et survivent aux
   * régénérations, qui ne réécrivent que la partie générée.
   */
  private readonly lignesManuelles = new WeakSet<FormGroup>();

  /** Paramètres de la série. Toute saisie ici régénère la grille en dessous. */
  readonly lotParams = this.fb.nonNullable.group({
    prefixe: ['T', [Validators.maxLength(40)]],
    debut: [1, [Validators.required, Validators.min(0)]],
    fin: [10, [Validators.required, Validators.min(0)]],
    chiffres: [2, [Validators.required, Validators.min(1), Validators.max(6)]],
    capacite: [4, [Validators.required, Validators.min(1)]],
  });

  readonly lotDoublons = computed(() => new Set(indexesEnDoublon(this.lotNumeros())));

  readonly lotPret = computed(
    () =>
      this.lotLignes().length > 0 &&
      this.lotDoublons().size === 0 &&
      this.lotLignes().every((g) => g.valid),
  );

  constructor() {
    // Les statuts de table changent au fil du service, y compris depuis un
    // autre poste. En pause tiroir ouvert pour ne pas écraser une saisie.
    rafraichissementAuto(
      30_000,
      () => this.rechargerTables(),
      () => this.drawerOpen() || this.lotDrawerOpen(),
    );

    // L'en-tête est vivant : la grille suit la saisie, sans étape « combien ? ».
    this.lotParams.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.regenererGrille());

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
      .list(id, this.afficherArchivees())
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

  basculerArchivees(afficher: boolean): void {
    this.afficherArchivees.set(afficher);
    const pdvId = this.selectedPdvId();
    if (pdvId !== null) {
      this.loadTables(pdvId);
    }
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

  // ─────────────────────────── Création en série ───────────────────────────

  openLot(): void {
    this.lotError.set(null);
    this.lotLineErrors.set({});
    this.lotLignes.set([]);
    this.lotParams.reset({ prefixe: 'T', debut: 1, fin: 10, chiffres: 2, capacite: 4 });
    this.regenererGrille();
    this.lotDrawerOpen.set(true);
  }

  closeLot(): void {
    this.lotDrawerOpen.set(false);
  }

  /** Numéros courants de la grille, dans l'ordre d'affichage et d'envoi. */
  lotNumeros(): string[] {
    return this.lotLignes().map((g) => String(g.controls['numero'].value ?? ''));
  }

  private lotLigneGroup(numero: string, capacite: number): FormGroup {
    return this.fb.nonNullable.group({
      numero: [numero, [Validators.required, Validators.maxLength(50)]],
      capacite: [capacite, [Validators.required, Validators.min(1)]],
    });
  }

  /**
   * Réaligne la grille sur les paramètres de la série.
   *
   * Ne réécrit qu'un champ que l'utilisateur n'a pas touché : `dirty` n'est posé
   * que par une saisie à l'écran, jamais par `setValue`. Corriger la capacité de
   * la table 7 puis étendre la plage préserve donc cette correction — c'est tout
   * l'intérêt de la grille par rapport à un générateur aveugle.
   */
  private regenererGrille(): void {
    const { prefixe, debut, fin, chiffres, capacite } = this.lotParams.getRawValue();
    const numeros = genererNumeros({ prefixe, debut: Number(debut), fin: Number(fin), chiffres });

    const actuelles = this.lotLignes();
    const manuelles = actuelles.filter((g) => this.lignesManuelles.has(g));
    const generees = actuelles.filter((g) => !this.lignesManuelles.has(g));

    const suivantes = numeros.map((numero, i) => {
      const existante = generees[i];
      if (existante === undefined) {
        return this.lotLigneGroup(numero, capacite);
      }
      if (!existante.controls['numero'].dirty) {
        existante.controls['numero'].setValue(numero, { emitEvent: false });
      }
      if (!existante.controls['capacite'].dirty) {
        existante.controls['capacite'].setValue(capacite, { emitEvent: false });
      }
      return existante;
    });

    this.lotLignes.set([...suivantes, ...manuelles]);
    // Les erreurs sont indexées par position : elles ne veulent plus rien dire.
    this.lotLineErrors.set({});
  }

  ajouterLigneLot(): void {
    const { capacite } = this.lotParams.getRawValue();
    const ligne = this.lotLigneGroup('', capacite);
    this.lignesManuelles.add(ligne);
    this.lotLignes.update((list) => [...list, ligne]);
    this.lotLineErrors.set({});
  }

  retirerLigneLot(group: FormGroup): void {
    this.lotLignes.update((list) => list.filter((g) => g !== group));
    this.lotLineErrors.set({});
  }

  /** Une saisie corrige la ligne : son erreur serveur n'a plus lieu d'être. */
  onLigneLotSaisie(index: number): void {
    this.lotLineErrors.update((map) => {
      const { [index]: _retire, ...reste } = map;
      return reste;
    });
  }

  enregistrerLot(): void {
    const pdvId = this.selectedPdvId();
    const groups = this.lotLignes();
    if (pdvId === null || groups.length === 0 || this.lotSaving()) {
      return;
    }

    if (groups.some((g) => g.invalid)) {
      groups.forEach((g) => g.markAllAsTouched());
      return;
    }

    // Doublon visible à l'écran : inutile de faire l'aller-retour pour se le
    // faire refuser par le back.
    const doublons = this.lotDoublons();
    if (doublons.size > 0) {
      this.lotLineErrors.set(
        Object.fromEntries([...doublons].map((i) => [i, 'Ce numéro apparaît deux fois.'])),
      );
      this.lotError.set('Deux tables portent le même numéro.');
      return;
    }

    const lignes: TableLotLigne[] = groups.map((g) => ({
      numero: String(g.controls['numero'].value).trim(),
      capacite: Number(g.controls['capacite'].value),
    }));

    this.lotSaving.set(true);
    this.lotError.set(null);
    this.lotLineErrors.set({});

    this.tableService
      .createLot(pdvId, lignes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (creees) => {
          this.lotSaving.set(false);
          this.lotDrawerOpen.set(false);
          this.tables.update((list) =>
            [...list, ...creees].sort((a, b) =>
              a.numero.localeCompare(b.numero, 'fr', { numeric: true }),
            ),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.lotSaving.set(false);
          this.lotLineErrors.set(erreursParLigne(err));
          this.lotError.set(apiErrorMessage(err, 'Création en série impossible.'));
        },
      });
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
          this.alertes.erreur(apiErrorMessage(err, 'Génération du QR impossible.'));
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
          this.alertes.erreur(apiErrorMessage(err, 'Génération de la planche impossible.'));
        },
      });
  }

  /**
   * Régénère le jeton : opération destructrice pour les QR déjà collés en
   * salle, d'où la confirmation explicite.
   */
  async regenererToken(table: TableSalle): Promise<void> {
    const confirme = await this.alertes.confirmer({
      titre: `Régénérer le QR de la table ${table.numero} ?`,
      texte:
        'Les QR déjà imprimés pour cette table cesseront de fonctionner et devront être remplacés.',
      confirmer: 'Régénérer',
      danger: true,
    });
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
        error: (err: HttpErrorResponse) =>
          this.alertes.erreur(apiErrorMessage(err, 'Régénération impossible.')),
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
      () => this.alertes.avertissement('Copie impossible. Sélectionnez le lien manuellement.'),
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
        error: (err: HttpErrorResponse) =>
          this.alertes.erreur(apiErrorMessage(err, 'Changement impossible.')),
      });
  }

  /**
   * Retire la table du service. C'est la seule issue pour une table qui a déjà
   * servi : la suppression lui est définitivement fermée. Le jeton public est
   * conservé, donc réactiver fait refonctionner les QR déjà imprimés.
   */
  async archiver(table: TableSalle): Promise<void> {
    const confirme = await this.alertes.confirmer({
      titre: `Archiver la table ${table.numero} ?`,
      texte:
        'Elle sortira du plan de salle et de la caisse, et son QR cessera de servir un menu. ' +
        'Son historique de commandes est conservé, et vous pourrez la réactiver.',
      confirmer: 'Archiver',
      danger: true,
    });
    if (!confirme) {
      return;
    }

    this.archiving.set(true);
    this.tableService
      .archiver(table.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => this.apresArchivage(updated),
        error: (err: HttpErrorResponse) => {
          this.archiving.set(false);
          this.alertes.erreur(apiErrorMessage(err, 'Archivage impossible.'));
        },
      });
  }

  reactiver(table: TableSalle): void {
    this.archiving.set(true);
    this.tableService
      .reactiver(table.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => this.apresArchivage(updated),
        error: (err: HttpErrorResponse) => {
          this.archiving.set(false);
          this.alertes.erreur(apiErrorMessage(err, 'Réactivation impossible.'));
        },
      });
  }

  /**
   * Une table qui vient d'être archivée disparaît de la liste tant que la
   * bascule est fermée — la garder afficherait une carte que le filtre courant
   * exclut.
   */
  private apresArchivage(updated: TableSalle): void {
    this.archiving.set(false);
    if (updated.archivee_le !== null && !this.afficherArchivees()) {
      this.tables.update((list) => list.filter((t) => t.id !== updated.id));
      this.drawerOpen.set(false);
      return;
    }
    this.tables.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    this.editingTable.set(updated);
  }

  async delete(table: TableSalle): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(String(table.numero), { nature: 'la table' }))) {
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
          this.alertes.erreur(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}

/**
 * Répartit les erreurs d'un 422 par ligne de grille.
 *
 * Laravel les renvoie sous la clé `lignes.{index}.{champ}` : l'index est
 * exactement la position dans la grille, la ligne fautive se surligne donc sans
 * effort de correspondance.
 */
function erreursParLigne(err: HttpErrorResponse): Record<number, string> {
  const errors = err.error?.errors as Record<string, string[]> | undefined;
  if (!errors) {
    return {};
  }

  const map: Record<number, string> = {};
  for (const [cle, messages] of Object.entries(errors)) {
    const correspondance = cle.match(/^lignes\.(\d+)\./);
    if (correspondance && messages.length > 0) {
      map[Number(correspondance[1])] ??= messages[0];
    }
  }
  return map;
}
