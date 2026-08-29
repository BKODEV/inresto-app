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
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';

import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import { CommandeClient } from '../../../core/api/commande-client/commande-client.model';
import { ModeDePaiementService } from '../../../core/api/mode-de-paiement/mode-de-paiement.service';
import { ModeDePaiement } from '../../../core/api/mode-de-paiement/mode-de-paiement.model';
import {
  modeParDefaut,
  modesProposables,
} from '../../../core/api/mode-de-paiement/mode-de-paiement.util';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import {
  SaisieReglement,
  monnaieARendre,
  payloadPaiement,
  pourboireApresAvoirGardeLaMonnaie,
  recuInsuffisant,
  recuManquant,
} from './reglement.util';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { formatMontant } from '../../../shared/format/nombre.format';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

/**
 * Poste de caisse : la file des notes servies, en attente de règlement.
 *
 * Distinct de la prise de commande, qui montre un plan de salle : le caissier
 * ne cherche pas une table, il solde une file. L'argent entre dans le système
 * ici et nulle part ailleurs : le client se déplace pour régler, et c'est le
 * caissier qui saisit. Le `montant_theorique` de la session ne compte que les
 * modes marqués « en tiroir » — un virement est encaissé, mais on ne le
 * retrouve pas en comptant la caisse.
 *
 * Le règlement se fait dans la file, sans changer d'écran : renvoyer le
 * caissier sur la fiche de commande le déposait sur l'écran du serveur — une
 * grille de produits et un panier dont il n'a que faire — et lui faisait
 * perdre sa place dans la file. La fiche reste accessible par le numéro de
 * note, pour ce qui demande plus qu'un encaissement : remise, vérification des
 * lignes, impression.
 */
@Component({
  selector: 'app-encaissement-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SiteRequisComponent, MontantPipe],
  templateUrl: './encaissement.page.html',
  styleUrls: ['./caisse.page.scss', './encaissement.page.scss', './reglement.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncaissementPage implements OnInit {
  private readonly commandeService = inject(CommandeClientService);
  private readonly modeService = inject(ModeDePaiementService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly pdfService = inject(PdfService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly allPdvs = signal<PointDeVente[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly pdvs = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);

  readonly notes = signal<CommandeClient[]>([]);
  readonly modes = signal<ModeDePaiement[]>([]);
  readonly loading = signal(true);
  readonly loadingNotes = signal(false);

  /**
   * Clôturer est une permission distincte de saisir un paiement : un caissier
   * qui ne l'aurait pas encaisse quand même, la note reste juste à solder par
   * un responsable. On enregistre l'argent plutôt que de bloquer.
   */
  readonly peutEncaisser = computed(() => this.auth.hasPermission('commande_client.encaisser'));

  /** Filtre par serveur : le geste du versement, quand l'un d'eux se présente. */
  readonly filtreServeur = signal<string>('');

  readonly serveurs = computed(() =>
    [...new Set(this.notes().map((c) => c.serveur ?? '—'))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    ),
  );

  readonly notesFiltrees = computed(() => {
    const serveur = this.filtreServeur();
    return serveur === ''
      ? this.notes()
      : this.notes().filter((c) => (c.serveur ?? '—') === serveur);
  });

  readonly totalAEncaisser = computed(() =>
    this.notesFiltrees().reduce((total, c) => total + Number(c.reste_a_payer), 0),
  );

  // ── Tiroir de règlement ─────────────────────────────────────────────────
  /** Note en cours de règlement. Non nulle = tiroir ouvert. */
  readonly cible = signal<CommandeClient | null>(null);
  /**
   * Le tiroir ne se referme pas sur la clôture : il bascule sur ce que le
   * caissier doit encore faire de ses mains — rendre la monnaie et remettre le
   * reçu. Fermer ici lui retirerait le seul chiffre qui compte à cet instant.
   */
  readonly etape = signal<'saisie' | 'reglee'>('saisie');
  readonly busy = signal(false);
  readonly pdfBusy = signal(false);
  readonly formError = signal<string | null>(null);
  /** Trace du paiement partiel : ce qui vient d'être encaissé, ce qui reste. */
  readonly info = signal<string | null>(null);
  /** Monnaie du geste qu'on vient de valider, à afficher sur la confirmation. */
  readonly monnaieARendre = signal(0);

  readonly reglementForm = this.fb.nonNullable.group({
    mode_de_paiement_id: [0, [Validators.required, Validators.min(1)]],
    montant: [0, [Validators.required, Validators.min(0.01)]],
    montant_recu: [0],
    pourboire: [0],
  });

  private readonly montantSaisi = signal(0);
  private readonly recuSaisi = signal(0);
  private readonly pourboireSaisi = signal(0);
  private readonly modeSaisi = signal(0);

  /**
   * Le mode retenu fait-il entrer des espèces dans le tiroir ? C'est lui qui
   * rend le billet tendu obligatoire : hors tiroir, il n'y a rien à saisir.
   */
  readonly modeEnTiroir = computed(
    () => this.modes().find((m) => m.id === this.modeSaisi())?.compte_en_caisse ?? false,
  );

  /**
   * Ce qu'il restera après ce paiement. Le caissier voit tout de suite s'il
   * solde la note ou s'il enchaîne un second règlement, avant de valider.
   */
  readonly resteApres = computed(() => {
    const reste = Number(this.cible()?.reste_a_payer ?? 0);

    return Math.round((reste - this.montantSaisi()) * 100) / 100;
  });

  readonly soldeLaNote = computed(() => this.cible() !== null && this.resteApres() <= 0);

  /**
   * Monnaie à rendre, calculée sur le billet tendu. Ce n'est qu'un aide-calcul
   * d'affichage : c'est `montant` qui est enregistré, jamais le billet, sans
   * quoi le fond de caisse théorique compterait de l'argent déjà rendu.
   */
  readonly monnaieSaisie = computed(() => monnaieARendre(this.saisie()));

  /** Saisie inversée : le billet doit couvrir la vente ET le pourboire. */
  readonly recuInsuffisant = computed(() => recuInsuffisant(this.saisie()));

  /** Espèces tendues non saisies sur un mode qui alimente le tiroir. */
  readonly recuManquant = computed(() => recuManquant(this.saisie()));

  /** Les trois montants du comptoir, tels que l'arithmétique les attend. */
  private readonly saisie = computed<SaisieReglement>(() => ({
    montant: this.montantSaisi(),
    pourboire: this.pourboireSaisi(),
    recu: this.recuSaisi(),
    enTiroir: this.modeEnTiroir(),
  }));

  /** Horloge d'affichage : l'ancienneté se recalcule à chaque tic. */
  private readonly maintenant = signal(Date.now());

  constructor() {
    // Une note servie peut arriver à tout moment depuis la salle. Suspendu
    // tiroir ouvert : remplacer la liste sous le caissier lui ferait valider un
    // montant calculé sur une note déjà remplacée.
    rafraichissementAuto(
      20_000,
      () => this.recharger(),
      () => this.cible() !== null,
    );
    rafraichissementAuto(30_000, () => this.maintenant.set(Date.now()));

    this.reglementForm.controls.montant.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valeur) => this.montantSaisi.set(Number(valeur) || 0));
    this.reglementForm.controls.montant_recu.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valeur) => this.recuSaisi.set(Number(valeur) || 0));
    this.reglementForm.controls.pourboire.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valeur) => this.pourboireSaisi.set(Number(valeur) || 0));
    this.reglementForm.controls.mode_de_paiement_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valeur) => this.modeSaisi.set(Number(valeur) || 0));

    effect(() => {
      const list = this.pdvs();
      const courant = untracked(() => this.selectedPdvId());
      if (courant !== null && list.some((p) => p.id === courant)) {
        return;
      }
      const suivant = list[0]?.id ?? null;
      this.selectedPdvId.set(suivant);
      if (suivant !== null) {
        this.charger(suivant);
      } else {
        this.notes.set([]);
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

    this.modeService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modes) => this.modes.set(modesProposables(modes)));
  }

  onPdvChange(valeur: string): void {
    const id = Number(valeur);
    this.selectedPdvId.set(id);
    this.charger(id);
  }

  onFiltreServeur(valeur: string): void {
    this.filtreServeur.set(valeur);
  }

  /** Minutes écoulées depuis l'ouverture : les notes qui traînent remontent. */
  attente(commande: CommandeClient): string {
    const minutes = Math.max(
      0,
      Math.floor((this.maintenant() - new Date(commande.date_heure).getTime()) / 60_000),
    );
    if (minutes < 60) {
      return `${minutes} min`;
    }

    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  // ─────────── règlement ───────────

  ouvrirReglement(commande: CommandeClient): void {
    this.formError.set(null);
    this.info.set(null);
    this.monnaieARendre.set(0);
    this.etape.set('saisie');
    this.cible.set(commande);
    this.reglementForm.reset({
      mode_de_paiement_id: modeParDefaut(this.modes()),
      montant: Number(commande.reste_a_payer),
      montant_recu: 0,
      pourboire: 0,
    });
  }

  /**
   * Bascule la monnaie restante en pourboire. C'est le « gardez la monnaie »
   * du comptoir, en un geste plutôt qu'un calcul mental puis une saisie.
   */
  garderLaMonnaie(): void {
    if (this.monnaieSaisie() <= 0) {
      return;
    }
    this.reglementForm.patchValue({
      pourboire: pourboireApresAvoirGardeLaMonnaie(this.saisie()),
    });
  }

  /** Sélection d'un mode par bouton, en lieu et place d'une liste déroulante. */
  choisirMode(id: number): void {
    this.reglementForm.patchValue({ mode_de_paiement_id: id });
  }

  fermerReglement(): void {
    if (this.busy()) {
      return;
    }
    this.cible.set(null);
    this.etape.set('saisie');
    this.info.set(null);
    this.formError.set(null);
  }

  /** Le détail et le TOTAL À PAYER, à présenter au client avant qu'il ne règle. */
  imprimerAddition(): void {
    const commande = this.cible();
    if (commande === null) {
      return;
    }
    this.ouvrirPdf(this.pdfService.additionClient(commande.id), `addition-${commande.id}.pdf`);
  }

  /** La preuve du paiement, monnaie comprise, remise avec la monnaie. */
  imprimerRecu(): void {
    const commande = this.cible();
    if (commande === null) {
      return;
    }
    this.ouvrirPdf(this.pdfService.recuClient(commande.id), `recu-${commande.id}.pdf`);
  }

  private ouvrirPdf(source: Observable<Blob>, nomFichier: string): void {
    this.pdfBusy.set(true);
    this.formError.set(null);
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.pdfBusy.set(false);
        ouvrirPdfDansOnglet(blob, nomFichier);
      },
      error: (err: HttpErrorResponse) => {
        this.pdfBusy.set(false);
        this.formError.set(apiErrorMessage(err, 'Impression impossible.'));
      },
    });
  }

  /**
   * Enregistre le paiement puis clôture si la note tombe à zéro — le geste
   * unique du comptoir. Un montant inférieur au reste laisse la note dans la
   * file, tiroir ouvert sur le nouveau reste : espèces puis carte, ou acompte,
   * s'enchaînent sans rien rouvrir.
   */
  regler(): void {
    const commande = this.cible();
    if (commande === null || this.busy()) {
      return;
    }
    if (this.reglementForm.invalid) {
      this.reglementForm.markAllAsTouched();

      return;
    }
    if (this.recuManquant()) {
      this.formError.set('Saisissez les espèces tendues par le client.');

      return;
    }
    if (this.recuInsuffisant()) {
      this.formError.set('Le montant reçu est inférieur au montant encaissé.');

      return;
    }

    this.busy.set(true);
    this.formError.set(null);
    this.info.set(null);

    const monnaie = this.monnaieSaisie();
    const paiement = payloadPaiement(
      this.reglementForm.getRawValue().mode_de_paiement_id,
      this.saisie(),
    );

    this.commandeService
      .ajouterPaiement(commande.id, paiement)
      // On relit la note plutôt que de soustraire de tête : une remise a pu
      // être appliquée depuis la fiche entre l'ouverture du tiroir et ici.
      .pipe(
        switchMap(() => this.commandeService.get(commande.id)),
        switchMap((maj) =>
          Number(maj.reste_a_payer) <= 0 && this.peutEncaisser()
            ? this.commandeService.encaisser(commande.id)
            : of(maj),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (maj) => {
          this.busy.set(false);

          if (maj.statut === 'encaissee') {
            // La note quitte la file tout de suite — elle est réglée — mais le
            // tiroir reste ouvert sur la monnaie et le reçu.
            this.retirerDeLaFile(maj.id);
            this.cible.set(maj);
            this.monnaieARendre.set(monnaie);
            this.etape.set('reglee');

            return;
          }

          const reste = Number(maj.reste_a_payer);
          if (reste > 0) {
            this.majDansLaFile(maj);
            this.cible.set(maj);
            this.reglementForm.patchValue({ montant: reste, montant_recu: 0, pourboire: 0 });
            this.info.set(
              `Paiement de ${formatMontant(paiement.montant)} enregistré. Reste ${formatMontant(reste)}.`,
            );

            return;
          }

          // Soldée mais pas clôturable par ce compte : l'argent est saisi, la
          // note attend un responsable.
          this.majDansLaFile(maj);
          this.cible.set(null);
          this.info.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.formError.set(apiErrorMessage(err, 'Règlement impossible.'));
        },
      });
  }

  private retirerDeLaFile(id: number): void {
    this.notes.update((notes) => notes.filter((c) => c.id !== id));
  }

  private majDansLaFile(commande: CommandeClient): void {
    this.notes.update((notes) => notes.map((c) => (c.id === commande.id ? commande : c)));
  }

  private recharger(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId !== null) {
      this.charger(pdvId, { discret: true });
    }
  }

  private charger(pdvId: number, options: { discret?: boolean } = {}): void {
    if (options.discret !== true) {
      this.loadingNotes.set(true);
    }
    this.commandeService
      .list({ point_de_vente_id: pdvId, statut: ['servie'] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (notes) => {
          // Les plus anciennes d'abord : c'est l'ordre dans lequel on solde.
          this.notes.set(
            [...notes].sort(
              (a, b) => new Date(a.date_heure).getTime() - new Date(b.date_heure).getTime(),
            ),
          );
          this.loadingNotes.set(false);
        },
        error: () => this.loadingNotes.set(false),
      });
  }
}
