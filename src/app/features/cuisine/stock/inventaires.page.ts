import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { InventaireService } from '../../../core/api/inventaire/inventaire.service';
import {
  Inventaire,
  LigneInventaire,
  RapportInventaire,
} from '../../../core/api/inventaire/inventaire.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { QuantitePipe } from '../../../shared/format/nombre.pipes';

@Component({
  selector: 'app-inventaires-page',
  standalone: true,
  imports: [ReactiveFormsModule, SiteRequisComponent, QuantitePipe],
  templateUrl: './inventaires.page.html',
  styleUrl: './inventaires.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventairesPage implements OnInit {
  private readonly service = inject(InventaireService);
  private readonly matiereService = inject(MatierePremiereService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Sites + sélection pilotés par le sélecteur global de la topbar.
  readonly sites = this.selectedSite.sites;
  readonly selectedSiteId = this.selectedSite.selectedId;
  readonly currentSite = this.selectedSite.selectedSite;
  readonly siteLoading = this.selectedSite.loading;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly items = signal<Inventaire[]>([]);
  readonly matieres = signal<MatierePremiere[]>([]);
  readonly loading = signal(true);
  readonly listError = signal<string | null>(null);
  readonly creating = signal(false);

  // Détail
  readonly detail = signal<Inventaire | null>(null);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly ligneSaving = signal(false);
  readonly ligneError = signal<string | null>(null);
  readonly busy = signal(false);

  // Rapport
  readonly rapport = signal<RapportInventaire | null>(null);
  readonly rapportOpen = signal(false);
  readonly rapportLoading = signal(false);

  readonly canCreate = computed(() => this.auth.hasPermission('inventaire.create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('inventaire.update'));
  readonly canDelete = computed(() => this.auth.hasPermission('inventaire.delete'));
  readonly detailEnCours = computed(() => this.detail()?.statut === 'en_cours');

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  readonly ligneForm = this.fb.nonNullable.group({
    matiere_premiere_id: [null as number | null, [Validators.required]],
    quantite_physique: [null as number | null, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    // Recharge la liste d'inventaires dès que le site global change.
    effect(() => {
      const site = this.selectedSite.selectedSite();
      if (site) {
        this.loadList(site.id);
      } else {
        this.items.set([]);
        this.loading.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.matiereService
      .list({ statut: 'actif' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.matieres.set(data));
  }

  private loadList(siteId: number): void {
    this.loading.set(true);
    this.listError.set(null);
    this.service
      .list(siteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.inventaires);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  matiereLibelle(ligne: LigneInventaire): string {
    return (
      ligne.matiere_premiere?.libelle ??
      this.matieres().find((m) => m.id === ligne.matiere_premiere_id)?.libelle ??
      `Matière #${ligne.matiere_premiere_id}`
    );
  }

  formatMontant(value: string | null): string {
    return value === null ? '—' : this.montantFormatter.format(Number(value));
  }

  formatDate(value: string | null): string {
    return value ? this.dateFormatter.format(new Date(value)) : '—';
  }

  ecartClass(ecart: string | null): string {
    if (ecart === null) {
      return '';
    }
    const n = Number(ecart);
    return n < 0 ? 'neg' : n > 0 ? 'pos' : '';
  }

  // ── Création ────────────────────────────────────────────────────────────

  creerInventaire(): void {
    const siteId = this.selectedSiteId();
    if (!siteId || this.creating()) {
      return;
    }
    this.creating.set(true);
    this.listError.set(null);
    this.service
      .create({ site_id: siteId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (inv) => {
          this.creating.set(false);
          this.loadList(siteId);
          this.openDetail(inv);
        },
        error: (err: HttpErrorResponse) => {
          this.creating.set(false);
          // 409 : un inventaire en cours existe déjà pour ce site.
          this.listError.set(apiErrorMessage(err, 'Création impossible.'));
        },
      });
  }

  deleteInventaire(item: Inventaire): void {
    if (!confirm('Supprimer cet inventaire ?')) {
      return;
    }
    this.service
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.items.update((list) => list.filter((i) => i.id !== item.id)),
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Suppression impossible.')),
      });
  }

  // ── Détail / saisie ─────────────────────────────────────────────────────

  openDetail(item: Inventaire): void {
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailOpen.set(true);
    this.ligneError.set(null);
    this.ligneForm.reset({ matiere_premiere_id: null, quantite_physique: null });
    this.service
      .get(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (inv) => {
          this.detail.set(inv);
          this.detailLoading.set(false);
        },
        error: () => this.detailLoading.set(false),
      });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

  private reloadDetail(): void {
    const current = this.detail();
    if (current) {
      this.service
        .get(current.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((inv) => this.detail.set(inv));
    }
  }

  ajouterLigne(): void {
    const inv = this.detail();
    if (this.ligneForm.invalid || this.ligneSaving() || !inv) {
      this.ligneForm.markAllAsTouched();
      return;
    }
    this.ligneSaving.set(true);
    this.ligneError.set(null);
    const raw = this.ligneForm.getRawValue();
    this.service
      .addLigne(inv.id, {
        matiere_premiere_id: raw.matiere_premiere_id!,
        quantite_physique: raw.quantite_physique!,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.ligneSaving.set(false);
          this.ligneForm.reset({ matiere_premiere_id: null, quantite_physique: null });
          this.reloadDetail();
        },
        error: (err: HttpErrorResponse) => {
          this.ligneSaving.set(false);
          this.ligneError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }

  supprimerLigne(ligne: LigneInventaire): void {
    const inv = this.detail();
    if (!inv) {
      return;
    }
    this.service
      .deleteLigne(inv.id, ligne.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reloadDetail(),
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Suppression impossible.')),
      });
  }

  cloturer(): void {
    const inv = this.detail();
    if (!inv || this.busy()) {
      return;
    }
    if (
      !confirm('Clôturer cet inventaire ? Les écarts corrigeront le stock. Action irréversible.')
    ) {
      return;
    }
    this.busy.set(true);
    this.service
      .cloturer(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.detail.set(updated);
          const siteId = this.selectedSiteId();
          if (siteId) {
            this.loadList(siteId);
          }
          this.reloadDetail();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.ligneError.set(apiErrorMessage(err, 'Clôture impossible.'));
        },
      });
  }

  // ── Rapport ─────────────────────────────────────────────────────────────

  openRapport(item: Inventaire): void {
    this.rapport.set(null);
    this.rapportLoading.set(true);
    this.rapportOpen.set(true);
    this.service
      .rapport(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.rapport.set(data);
          this.rapportLoading.set(false);
        },
        error: () => this.rapportLoading.set(false),
      });
  }

  closeRapport(): void {
    this.rapportOpen.set(false);
  }
}
