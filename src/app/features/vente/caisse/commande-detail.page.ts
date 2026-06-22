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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import {
  CommandeClient,
  LigneCommandeClient,
  SortAnnulation,
  StatutCommandeClient,
  TypeRemise,
} from '../../../core/api/commande-client/commande-client.model';
import { CarteService } from '../../../core/api/carte/carte.service';
import { CarteProduitService } from '../../../core/api/carte/carte-produit.service';
import { CarteProduit } from '../../../core/api/carte/carte-produit.model';
import { ModeDePaiementService } from '../../../core/api/mode-de-paiement/mode-de-paiement.service';
import { ModeDePaiement } from '../../../core/api/mode-de-paiement/mode-de-paiement.model';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';

type DrawerMode = 'paiement' | 'remise' | 'annuler-ligne' | null;

@Component({
  selector: 'app-commande-vente-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './commande-detail.page.html',
  styleUrl: './caisse.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandeVenteDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly commandeService = inject(CommandeClientService);
  private readonly carteService = inject(CarteService);
  private readonly carteProduitService = inject(CarteProduitService);
  private readonly modeService = inject(ModeDePaiementService);
  private readonly pdfService = inject(PdfService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly commandeId = Number(this.route.snapshot.paramMap.get('id'));

  readonly commande = signal<CommandeClient | null>(null);
  readonly produitsCarte = signal<CarteProduit[]>([]);
  readonly modes = signal<ModeDePaiement[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly pdfBusy = signal(false);
  readonly error = signal<string | null>(null);

  readonly drawerMode = signal<DrawerMode>(null);
  readonly formError = signal<string | null>(null);
  readonly ligneCible = signal<LigneCommandeClient | null>(null);

  readonly statut = computed<StatutCommandeClient | null>(() => this.commande()?.statut ?? null);
  readonly estOuverte = computed(() => this.statut() === 'ouverte');
  readonly estEnvoyee = computed(() => this.statut() === 'envoyee_en_cuisine');
  readonly estServie = computed(() => this.statut() === 'servie');
  readonly estTerminee = computed(
    () => this.statut() === 'encaissee' || this.statut() === 'annulee',
  );
  readonly lignesActives = computed(
    () => this.commande()?.lignes?.filter((l) => l.statut === 'actif') ?? [],
  );

  readonly paiementForm = this.fb.nonNullable.group({
    mode_de_paiement_id: [0, [Validators.required, Validators.min(1)]],
    montant: [0, [Validators.required, Validators.min(0.01)]],
  });
  readonly remiseForm = this.fb.nonNullable.group({
    type: ['pourcentage' as TypeRemise, Validators.required],
    valeur: [0, [Validators.required, Validators.min(0.01)]],
    motif: [''],
  });
  readonly annulerLigneForm = this.fb.nonNullable.group({
    motif: ['', Validators.required],
    sort: ['remise_en_stock' as SortAnnulation],
  });

  ngOnInit(): void {
    this.modeService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modes) => this.modes.set(modes.filter((m) => m.statut === 'actif')));
    this.reload(true);
  }

  private reload(loadProduits = false): void {
    this.commandeService
      .get(this.commandeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (commande) => {
          this.commande.set(commande);
          this.loading.set(false);
          if (loadProduits) {
            this.chargerProduits(commande);
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Commande introuvable.');
        },
      });
  }

  private chargerProduits(commande: CommandeClient): void {
    const pdvId = commande.table?.point_de_vente_id;
    if (!pdvId) {
      return;
    }
    this.carteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cartes) => {
        const active = cartes.find((c) => c.point_de_vente_id === pdvId && c.statut === 'active');
        if (!active) {
          this.produitsCarte.set([]);
          return;
        }
        this.carteProduitService
          .list(active.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((lignes) =>
            this.produitsCarte.set(lignes.filter((l) => l.statut === 'actif')),
          );
      });
  }

  // ─────────── lignes ───────────

  ajouterProduit(cp: CarteProduit): void {
    if (!this.estOuverte() || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.commandeService
      .ajouterLigne(this.commandeId, { produit_id: cp.produit_id, quantite: 1 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.error.set(apiErrorMessage(err, 'Ajout impossible.'));
        },
      });
  }

  openAnnulerLigne(ligne: LigneCommandeClient): void {
    this.ligneCible.set(ligne);
    this.annulerLigneForm.reset({ motif: '', sort: 'remise_en_stock' });
    this.formError.set(null);
    this.drawerMode.set('annuler-ligne');
  }

  annulerLigne(): void {
    const ligne = this.ligneCible();
    if (this.annulerLigneForm.invalid || this.busy() || !ligne) {
      this.annulerLigneForm.markAllAsTouched();
      return;
    }
    const value = this.annulerLigneForm.getRawValue();
    const payload = this.estServie()
      ? { motif: value.motif, sort: value.sort }
      : { motif: value.motif };
    this.busy.set(true);
    this.formError.set(null);
    this.commandeService
      .annulerLigne(this.commandeId, ligne.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.drawerMode.set(null);
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.formError.set(apiErrorMessage(err, 'Annulation impossible.'));
        },
      });
  }

  // ─────────── transitions ───────────

  private action(call: ReturnType<CommandeClientService['servir']>, ok: string): void {
    this.busy.set(true);
    this.error.set(null);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (commande) => {
        this.busy.set(false);
        this.commande.set(commande);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err, `${ok} impossible.`));
      },
    });
  }

  envoyerEnCuisine(): void {
    this.action(this.commandeService.envoyerEnCuisine(this.commandeId), 'Envoi en cuisine');
  }

  servir(): void {
    this.action(this.commandeService.servir(this.commandeId), 'Service');
  }

  encaisser(): void {
    this.action(this.commandeService.encaisser(this.commandeId), 'Encaissement');
  }

  /** Ouvre la facture (A4) dans un nouvel onglet. */
  imprimerFacture(): void {
    this.ouvrirPdf(this.pdfService.factureClient(this.commandeId), `facture-${this.commandeId}.pdf`);
  }

  /** Ouvre le reçu (ticket 80mm) dans un nouvel onglet. */
  imprimerRecu(): void {
    this.ouvrirPdf(this.pdfService.recuClient(this.commandeId), `recu-${this.commandeId}.pdf`);
  }

  private ouvrirPdf(source$: Observable<Blob>, nomFichier: string): void {
    if (this.pdfBusy()) {
      return;
    }
    this.pdfBusy.set(true);
    this.error.set(null);
    source$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        ouvrirPdfDansOnglet(blob, nomFichier);
        this.pdfBusy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.pdfBusy.set(false);
        this.error.set(apiErrorMessage(err, 'Génération du PDF impossible.'));
      },
    });
  }

  annulerCommande(): void {
    const motif = prompt('Motif d’annulation de la commande ?');
    if (!motif) {
      return;
    }
    this.action(this.commandeService.annuler(this.commandeId, { motif }), 'Annulation');
  }

  // ─────────── paiement ───────────

  openPaiement(): void {
    this.paiementForm.reset({
      mode_de_paiement_id: this.modes()[0]?.id ?? 0,
      montant: Number(this.commande()?.reste_a_payer ?? 0),
    });
    this.formError.set(null);
    this.drawerMode.set('paiement');
  }

  ajouterPaiement(): void {
    if (this.paiementForm.invalid || this.busy()) {
      this.paiementForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    this.commandeService
      .ajouterPaiement(this.commandeId, this.paiementForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.drawerMode.set(null);
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.formError.set(apiErrorMessage(err, 'Paiement impossible.'));
        },
      });
  }

  // ─────────── remise ───────────

  openRemise(): void {
    this.remiseForm.reset({ type: 'pourcentage', valeur: 0, motif: '' });
    this.formError.set(null);
    this.drawerMode.set('remise');
  }

  ajouterRemise(): void {
    if (this.remiseForm.invalid || this.busy()) {
      this.remiseForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    this.commandeService
      .ajouterRemise(this.commandeId, this.remiseForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.drawerMode.set(null);
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.formError.set(apiErrorMessage(err, 'Remise refusée (seuil dépassé ?).'));
        },
      });
  }

  closeDrawer(): void {
    this.drawerMode.set(null);
  }

  retour(): void {
    this.router.navigate(['/vente/caisse/commandes']);
  }
}
