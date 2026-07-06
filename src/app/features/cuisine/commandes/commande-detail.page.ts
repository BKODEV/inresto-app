import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CommandeFournisseurService } from '../../../core/api/commande-fournisseur/commande-fournisseur.service';
import {
  CommandeFournisseur,
  LigneCommandeFournisseur,
} from '../../../core/api/commande-fournisseur/commande-fournisseur.model';
import { ReceptionService } from '../../../core/api/reception/reception.service';
import { CatalogueFournisseurService } from '../../../core/api/catalogue-fournisseur/catalogue-fournisseur.service';
import { CatalogueFournisseur } from '../../../core/api/catalogue-fournisseur/catalogue-fournisseur.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { STATUT_COMMANDE_BADGE, STATUT_COMMANDE_LABEL } from './statut-commande.labels';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-commande-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './commande-detail.page.html',
  styleUrl: './commande-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandeDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CommandeFournisseurService);
  private readonly receptionService = inject(ReceptionService);
  private readonly catalogueService = inject(CatalogueFournisseurService);
  private readonly matiereService = inject(MatierePremiereService);
  private readonly uniteService = inject(UniteDeMesureService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly pdfService = inject(PdfService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private commandeId!: number;

  readonly commande = signal<CommandeFournisseur | null>(null);
  readonly matieres = signal<MatierePremiere[]>([]);
  readonly unites = signal<UniteDeMesure[]>([]);
  // Catalogue du fournisseur de cette commande : on ne commande QUE ce qui y figure
  // (le catalogue porte le prix négocié + le facteur de conversion utilisé à la réception).
  readonly catalogue = signal<CatalogueFournisseur[]>([]);
  // Sites disponibles fournis par le sélecteur global (la réception cible un site).
  readonly sites = this.selectedSite.sites;
  readonly loading = signal(true);
  readonly actionError = signal<string | null>(null);
  readonly busy = signal(false);

  // Drawer ligne (brouillon)
  readonly ligneDrawerOpen = signal(false);
  readonly editingLigne = signal<LigneCommandeFournisseur | null>(null);
  readonly ligneSaving = signal(false);
  readonly ligneError = signal<string | null>(null);

  // Drawer réception
  readonly receptionDrawerOpen = signal(false);
  readonly receptionSaving = signal(false);
  readonly receptionError = signal<string | null>(null);
  readonly receptionSiteId = signal<number | null>(null);
  readonly receptionLignes = signal<FormGroup[]>([]);

  readonly statut = computed(() => this.commande()?.statut ?? 'brouillon');
  readonly isBrouillon = computed(() => this.statut() === 'brouillon');
  readonly isReceptionnable = computed(
    () => this.statut() === 'envoyee' || this.statut() === 'partiellement_recue',
  );
  readonly isAnnulable = computed(
    () => this.statut() !== 'cloturee' && this.statut() !== 'annulee',
  );

  /** Matières proposables dans le drawer ligne = strictement celles du catalogue. */
  readonly matieresCommandables = computed(() => {
    const matieres = this.matieres();
    return this.catalogue().map((entree) => ({
      id: entree.matiere_premiere_id,
      libelle:
        entree.matiere_premiere?.libelle ??
        matieres.find((m) => m.id === entree.matiere_premiere_id)?.libelle ??
        `Matière #${entree.matiere_premiere_id}`,
    }));
  });

  readonly canUpdate = computed(() => this.auth.hasPermission('commande-fournisseur.update'));
  readonly canDelete = computed(() => this.auth.hasPermission('commande-fournisseur.delete'));
  readonly canReceptionner = computed(() => this.auth.hasPermission('reception.create'));
  readonly pdfBusy = signal(false);

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  readonly ligneForm = this.fb.nonNullable.group({
    matiere_premiere_id: [null as number | null, [Validators.required]],
    quantite_commandee: [null as number | null, [Validators.required, Validators.min(0.001)]],
    prix_unitaire_previsionnel: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
  });

  ngOnInit(): void {
    this.commandeId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
    this.matiereService
      .list({ statut: 'actif' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.matieres.set(data));
    this.uniteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.unites.set(data));
    this.receptionSiteId.set(this.selectedSite.selectedId());
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .get(this.commandeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.commande.set(data);
          this.loading.set(false);
          this.loadCatalogue(data.fournisseur_id);
        },
        error: () => this.loading.set(false),
      });
  }

  /** Charge le catalogue du fournisseur pour restreindre le choix des matières. */
  private loadCatalogue(fournisseurId: number): void {
    this.catalogueService
      .list({ fournisseur_id: fournisseurId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.catalogue.set(data));
  }

  /**
   * À la sélection d'une matière, préremplit le prix négocié depuis le catalogue
   * (l'utilisateur reste libre d'ajuster prix et quantité). L'unité n'est PAS
   * choisie : elle est imposée par le catalogue (unité d'achat), affichée en
   * lecture seule via {@see uniteAchatSelectionnee}.
   */
  onMatiereSelected(): void {
    const matiereId = this.ligneForm.controls.matiere_premiere_id.value;
    const entree = this.catalogue().find((c) => c.matiere_premiere_id === matiereId);
    if (entree) {
      this.ligneForm.patchValue({
        prix_unitaire_previsionnel: Number(entree.prix_unitaire),
      });
    }
  }

  /**
   * Symbole de l'unité d'achat (catalogue) de la matière sélectionnée dans le
   * drawer ligne. Lecture seule : l'unité d'une ligne suit toujours le catalogue.
   */
  uniteAchatSelectionnee(): string {
    const matiereId = this.ligneForm.controls.matiere_premiere_id.value;
    const entree = this.catalogue().find((c) => c.matiere_premiere_id === matiereId);
    if (!entree) {
      return '—';
    }
    return this.unites().find((u) => u.id === entree.unite_achat_id)?.symbole ?? '—';
  }

  // ── Helpers d'affichage ─────────────────────────────────────────────────

  statutLabel(): string {
    return STATUT_COMMANDE_LABEL[this.statut()];
  }

  statutBadge(): string {
    return STATUT_COMMANDE_BADGE[this.statut()];
  }

  matiereLibelle(ligne: LigneCommandeFournisseur): string {
    return (
      ligne.matiere_premiere?.libelle ??
      this.matieres().find((m) => m.id === ligne.matiere_premiere_id)?.libelle ??
      '—'
    );
  }

  uniteSymbole(uniteId: number, ligne?: LigneCommandeFournisseur): string {
    return ligne?.unite?.symbole ?? this.unites().find((u) => u.id === uniteId)?.symbole ?? '—';
  }

  formatMontant(value: string): string {
    return this.montantFormatter.format(Number(value));
  }

  formatDate(value: string | null): string {
    return value ? this.dateFormatter.format(new Date(value)) : '—';
  }

  // ── Transitions d'état ──────────────────────────────────────────────────

  envoyer(): void {
    if (!confirm('Envoyer cette commande au fournisseur ? Elle ne sera plus modifiable.')) {
      return;
    }
    this.runAction(this.service.envoyer(this.commandeId));
  }

  annuler(): void {
    if (!confirm('Annuler cette commande ?')) {
      return;
    }
    this.runAction(this.service.annuler(this.commandeId));
  }

  supprimer(): void {
    if (!confirm('Supprimer définitivement cette commande ?')) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.service
      .delete(this.commandeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/cuisine/commandes']),
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.actionError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }

  /** Ouvre le bon de commande PDF (en-tête = site courant, sinon site principal). */
  telechargerPdf(): void {
    if (this.pdfBusy()) {
      return;
    }
    this.pdfBusy.set(true);
    this.actionError.set(null);
    this.pdfService
      .bonCommandeFournisseur(this.commandeId, this.selectedSite.selectedId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const numero = this.commande()?.numero ?? this.commandeId;
          ouvrirPdfDansOnglet(blob, `bon-commande-${numero}.pdf`);
          this.pdfBusy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.pdfBusy.set(false);
          this.actionError.set(apiErrorMessage(err, 'Génération du PDF impossible.'));
        },
      });
  }

  private runAction(request$: ReturnType<CommandeFournisseurService['envoyer']>): void {
    this.busy.set(true);
    this.actionError.set(null);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (commande) => {
        this.commande.set(commande);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.actionError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  // ── Lignes (brouillon) ──────────────────────────────────────────────────

  openCreateLigne(): void {
    this.editingLigne.set(null);
    this.ligneForm.reset({
      matiere_premiere_id: null,
      quantite_commandee: null,
      prix_unitaire_previsionnel: null,
    });
    this.ligneError.set(null);
    this.ligneDrawerOpen.set(true);
  }

  openEditLigne(ligne: LigneCommandeFournisseur): void {
    this.editingLigne.set(ligne);
    this.ligneForm.reset({
      matiere_premiere_id: ligne.matiere_premiere_id,
      quantite_commandee: Number(ligne.quantite_commandee),
      prix_unitaire_previsionnel: Number(ligne.prix_unitaire_previsionnel),
    });
    this.ligneError.set(null);
    this.ligneDrawerOpen.set(true);
  }

  closeLigneDrawer(): void {
    this.ligneDrawerOpen.set(false);
  }

  saveLigne(): void {
    if (this.ligneForm.invalid || this.ligneSaving()) {
      this.ligneForm.markAllAsTouched();
      return;
    }
    this.ligneSaving.set(true);
    this.ligneError.set(null);
    const raw = this.ligneForm.getRawValue();
    const payload = {
      matiere_premiere_id: raw.matiere_premiere_id!,
      quantite_commandee: raw.quantite_commandee!,
      prix_unitaire_previsionnel: raw.prix_unitaire_previsionnel!,
    };
    const editing = this.editingLigne();
    const request$ = editing
      ? this.service.updateLigne(this.commandeId, editing.id, payload)
      : this.service.addLigne(this.commandeId, payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.ligneSaving.set(false);
        this.ligneDrawerOpen.set(false);
        this.load(); // recharge montant_previsionnel + lignes
      },
      error: (err: HttpErrorResponse) => {
        this.ligneSaving.set(false);
        this.ligneError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  deleteLigne(ligne: LigneCommandeFournisseur): void {
    if (!confirm('Supprimer cette ligne ?')) {
      return;
    }
    this.service
      .deleteLigne(this.commandeId, ligne.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: (err: HttpErrorResponse) =>
          this.actionError.set(apiErrorMessage(err, 'Une erreur est survenue.')),
      });
  }

  // ── Réception (flux 2 temps) ────────────────────────────────────────────

  private receptionGroup(ligne: LigneCommandeFournisseur): FormGroup {
    return this.fb.group({
      matiere_premiere_id: [ligne.matiere_premiere_id, [Validators.required]],
      matiere_libelle: [this.matiereLibelle(ligne)],
      // Unité d'achat (catalogue) affichée en lecture seule : le serveur la
      // ré-impose de toute façon. On ne l'envoie plus dans le payload.
      unite_symbole: [this.uniteSymbole(ligne.unite_id, ligne)],
      quantite_recue: [
        Number(ligne.quantite_commandee),
        [Validators.required, Validators.min(0.001)],
      ],
      prix_unitaire_reel: [
        Number(ligne.prix_unitaire_previsionnel),
        [Validators.required, Validators.min(0.01)],
      ],
    });
  }

  openReception(): void {
    const lignes = this.commande()?.lignes ?? [];
    this.receptionLignes.set(lignes.map((l) => this.receptionGroup(l)));
    this.receptionSiteId.set(this.selectedSite.selectedId() ?? this.sites()[0]?.id ?? null);
    this.receptionError.set(null);
    this.receptionDrawerOpen.set(true);
  }

  closeReceptionDrawer(): void {
    this.receptionDrawerOpen.set(false);
  }

  removeReceptionLigne(group: FormGroup): void {
    this.receptionLignes.update((list) => list.filter((g) => g !== group));
  }

  onReceptionSite(value: string): void {
    const id = value ? Number(value) : null;
    this.receptionSiteId.set(id);
    this.selectedSite.set(id);
  }

  confirmerReception(): void {
    if (this.receptionSaving()) {
      return;
    }
    const siteId = this.receptionSiteId();
    if (!siteId) {
      this.receptionError.set('Sélectionnez un site de réception.');
      return;
    }
    const groups = this.receptionLignes();
    if (groups.length === 0) {
      this.receptionError.set('Au moins une ligne reçue est requise.');
      return;
    }
    if (groups.some((g) => g.invalid)) {
      groups.forEach((g) => g.markAllAsTouched());
      return;
    }

    this.receptionSaving.set(true);
    this.receptionError.set(null);

    const lignes = groups.map((g) => ({
      matiere_premiere_id: g.value.matiere_premiere_id as number,
      quantite_recue: g.value.quantite_recue as number,
      prix_unitaire_reel: g.value.prix_unitaire_reel as number,
    }));

    // Étape 1 : créer l'entête. Étape 2 : confirmer (stock + dépenses + transition).
    this.receptionService
      .create({ commande_fournisseur_id: this.commandeId, site_id: siteId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reception) => {
          this.receptionService
            .confirmer(reception.id, lignes)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.receptionSaving.set(false);
                this.receptionDrawerOpen.set(false);
                this.load(); // statut commande transité
              },
              error: (err: HttpErrorResponse) => {
                this.receptionSaving.set(false);
                this.receptionError.set(
                  apiErrorMessage(err, 'La confirmation de la réception a échoué.'),
                );
              },
            });
        },
        error: (err: HttpErrorResponse) => {
          this.receptionSaving.set(false);
          this.receptionError.set(apiErrorMessage(err, 'La création de la réception a échoué.'));
        },
      });
  }
}
