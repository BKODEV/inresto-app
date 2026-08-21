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
  LigneAEnvoyer,
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
import { AuthService } from '../../../core/auth/auth.service';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

type DrawerMode = 'paiement' | 'remise' | 'annuler-ligne' | null;

@Component({
  selector: 'app-commande-vente-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MontantPipe],
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
  private readonly auth = inject(AuthService);

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

  /**
   * L'argent entre dans le système au poste de caisse, pas en salle : le
   * serveur qui encaisse à table vient verser, et c'est le caissier qui saisit.
   * Ces permissions séparent déjà les rôles (`serveur` n'a ni l'une ni
   * l'autre) ; l'écran s'y conforme au lieu de proposer des boutons qui
   * renverraient un 403.
   */
  readonly peutEncaisser = computed(() => this.auth.hasPermission('commande_client.encaisser'));
  readonly peutSaisirPaiement = computed(() => this.auth.hasPermission('paiement.create'));
  readonly peutAppliquerRemise = computed(() => this.auth.hasPermission('remise.create'));

  readonly statut = computed<StatutCommandeClient | null>(() => this.commande()?.statut ?? null);
  readonly estOuverte = computed(() => this.statut() === 'ouverte');
  readonly estEnvoyee = computed(() => this.statut() === 'envoyee_en_cuisine');
  readonly estServie = computed(() => this.statut() === 'servie');
  private readonly heure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });

  // ── Panier local ────────────────────────────────────────────────────────
  // Les plats s'empilent ici sans toucher au réseau, et partent en un seul
  // appel. Un aller-retour par plat serait lent et fragile sur le téléphone
  // d'un serveur en salle.
  readonly panier = signal<LignePanier[]>([]);
  readonly envoiEnCours = signal(false);

  readonly panierVide = computed(() => this.panier().length === 0);
  readonly panierNbArticles = computed(() =>
    this.panier().reduce((total, l) => total + l.quantite, 0),
  );
  readonly panierTotal = computed(() =>
    this.panier().reduce((total, l) => total + l.quantite * l.prix, 0),
  );

  readonly estTerminee = computed(
    () => this.statut() === 'encaissee' || this.statut() === 'annulee',
  );
  readonly lignesActives = computed(
    () => this.commande()?.lignes?.filter((l) => l.statut === 'actif') ?? [],
  );

  /**
   * Ticket groupé par tour, du plus ancien au plus récent.
   *
   * Une liste plate ne dit pas ce qui est déjà sur la table et ce qui cuit
   * encore : le serveur ne pouvait pas répondre à « et mon entrée ? » sans
   * aller voir en cuisine. Les lignes d'un même envoi partagent `envoyee_le`,
   * qui sert donc de clé de regroupement.
   *
   * Un tour sans horodatage n'est pas parti (ajout unitaire par l'API, hors
   * flux panier) : il reste en fin de liste, c'est le plus récent.
   */
  readonly toursTicket = computed<TourTicket[]>(() => {
    const groupes = new Map<string, LigneCommandeClient[]>();

    for (const ligne of this.lignesActives()) {
      const cle = ligne.envoyee_le ?? '';
      groupes.set(cle, [...(groupes.get(cle) ?? []), ligne]);
    }

    const envoyes = [...groupes.entries()]
      .filter(([cle]) => cle !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    const brouillon = groupes.get('');

    const tours: TourTicket[] = envoyes.map(([cle, lignes], index) => ({
      numero: index + 1,
      envoyeeLe: cle,
      etat: lignes.every((l) => l.servie_le !== null) ? 'servi' : 'en cuisine',
      lignes,
    }));

    if (brouillon !== undefined) {
      tours.push({
        numero: tours.length + 1,
        envoyeeLe: null,
        etat: 'non envoyé',
        lignes: brouillon,
      });
    }

    return tours;
  });

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
    this.restaurerPanier();
    this.reload(true);
  }

  /**
   * Le panier survit à un rechargement, une mise en arrière-plan ou une
   * batterie à plat : c'est ce qui rend acceptable de ne rien enregistrer côté
   * serveur avant l'envoi. Sans lui, le serveur qui a pris une table de huit
   * recommencerait tout.
   */
  private cleStockage(): string {
    return `inresto.panier.${this.commandeId}`;
  }

  private persisterPanier(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const lignes = this.panier();
    if (lignes.length === 0) {
      localStorage.removeItem(this.cleStockage());

      return;
    }
    localStorage.setItem(this.cleStockage(), JSON.stringify(lignes));
  }

  private restaurerPanier(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const brut = localStorage.getItem(this.cleStockage());
    if (brut === null) {
      return;
    }
    try {
      const lignes = JSON.parse(brut) as LignePanier[];
      if (Array.isArray(lignes)) {
        this.panier.set(lignes);
      }
    } catch {
      // Contenu illisible (format changé, écriture interrompue) : on repart
      // d'un panier vide plutôt que de casser l'écran.
      localStorage.removeItem(this.cleStockage());
    }
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

  /** Heure d'envoi d'un tour, au format court. */
  heureTour(iso: string | null): string {
    return iso === null ? '' : this.heure.format(new Date(iso));
  }

  /** Total de la ligne. Le prix unitaire seul se lit mal sur « 3× ». */
  totalLigne(ligne: LigneCommandeClient): number {
    return ligne.quantite * Number(ligne.prix_unitaire);
  }

  /**
   * Le geste n'est pas le même selon que la ligne est partie ou non : retrait
   * silencieux d'un côté, annulation motivée et tracée de l'autre. L'intitulé
   * doit l'annoncer AVANT le clic, sinon le motif se découvre dans le tiroir.
   */
  libelleRetrait(ligne: LigneCommandeClient): string {
    return ligne.envoyee_le === null
      ? 'Retirer la ligne'
      : 'Annuler la ligne — un motif sera demandé';
  }

  // ─────────── panier ───────────

  /**
   * Empile un plat. Aucun appel réseau : la ligne n'existera en base qu'à
   * l'envoi en cuisine. Taper deux fois le même plat incrémente sa quantité.
   */
  ajouterProduit(cp: CarteProduit): void {
    if (this.estTerminee()) {
      return;
    }
    this.error.set(null);
    this.panier.update((lignes) => {
      const existante = lignes.find((l) => l.produitId === cp.produit_id && l.commentaire === '');
      if (existante) {
        return lignes.map((l) => (l === existante ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [
        ...lignes,
        {
          produitId: cp.produit_id,
          libelle: cp.produit?.libelle ?? `#${cp.produit_id}`,
          prix: Number(cp.prix_vente),
          quantite: 1,
          commentaire: '',
        },
      ];
    });
    this.persisterPanier();
  }

  /** Retire du panier. Gratuit : la ligne n'a jamais existé côté serveur. */
  retirerDuPanier(index: number): void {
    this.panier.update((lignes) => lignes.filter((_, i) => i !== index));
    this.persisterPanier();
  }

  changerQuantite(index: number, delta: number): void {
    this.panier.update((lignes) =>
      lignes
        .map((l, i) => (i === index ? { ...l, quantite: l.quantite + delta } : l))
        .filter((l) => l.quantite > 0),
    );
    this.persisterPanier();
  }

  changerCommentaire(index: number, commentaire: string): void {
    this.panier.update((lignes) => lignes.map((l, i) => (i === index ? { ...l, commentaire } : l)));
    this.persisterPanier();
  }

  viderPanier(): void {
    this.panier.set([]);
    this.persisterPanier();
  }

  /**
   * Envoie le tour : les lignes du panier sont créées ET expédiées en cuisine
   * en un seul appel. Enregistrer sans envoyer n'aurait aucun sens — le serveur
   * croirait avoir commandé alors que rien ne cuit.
   */
  envoyerEnCuisine(): void {
    if (this.panierVide() || this.envoiEnCours()) {
      return;
    }

    const lignes: LigneAEnvoyer[] = this.panier().map((l) => ({
      produit_id: l.produitId,
      quantite: l.quantite,
      commentaire: l.commentaire.trim() === '' ? null : l.commentaire.trim(),
    }));

    this.envoiEnCours.set(true);
    this.error.set(null);
    this.commandeService
      .envoyerEnCuisine(this.commandeId, lignes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.envoiEnCours.set(false);
          this.viderPanier();
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.envoiEnCours.set(false);
          this.error.set(apiErrorMessage(err, 'Envoi impossible.'));
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

  servir(): void {
    this.action(this.commandeService.servir(this.commandeId), 'Service');
  }

  encaisser(): void {
    this.action(this.commandeService.encaisser(this.commandeId), 'Encaissement');
  }

  /** Ouvre la facture (A4) dans un nouvel onglet. */
  imprimerFacture(): void {
    this.ouvrirPdf(
      this.pdfService.factureClient(this.commandeId),
      `facture-${this.commandeId}.pdf`,
    );
  }

  /**
   * Ouvre l'addition (ticket 80mm) : le détail et le TOTAL À PAYER, sans aucune
   * ligne de paiement. Le reçu, lui, prouve un paiement déjà encaissé.
   */
  imprimerAddition(): void {
    this.ouvrirPdf(
      this.pdfService.additionClient(this.commandeId),
      `addition-${this.commandeId}.pdf`,
    );
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

  /** Vrai quand la commande n'a jamais rien porté : l'abandon est gratuit. */
  readonly peutEtreLiberee = computed(() => this.commande()?.peut_etre_liberee === true);

  /**
   * Abandon d'une commande vierge : aucun motif demandé, aucune trace
   * d'annulation. Taper une table la réserve ; défaire ce geste ne doit pas
   * coûter une justification, ni polluer la piste d'audit des annulations.
   */
  libererTable(): void {
    if (this.busy()) {
      return;
    }
    if (!confirm('Libérer la table ? La commande, encore vide, sera supprimée.')) {
      return;
    }

    this.busy.set(true);
    this.commandeService
      .liberer(this.commandeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/vente/caisse/commandes']),
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          alert(apiErrorMessage(err, 'Libération impossible.'));
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

/** Ligne du panier local, avant tout enregistrement en base. */
interface LignePanier {
  produitId: number;
  libelle: string;
  prix: number;
  quantite: number;
  commentaire: string;
}

/** Un envoi en cuisine, tel qu'affiché sur le ticket. */
interface TourTicket {
  numero: number;
  envoyeeLe: string | null;
  etat: 'servi' | 'en cuisine' | 'non envoyé';
  lignes: LigneCommandeClient[];
}
