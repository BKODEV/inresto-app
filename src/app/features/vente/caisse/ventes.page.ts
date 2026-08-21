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
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import {
  CommandeClientService,
  Pagination,
} from '../../../core/api/commande-client/commande-client.service';
import { CommandeClient } from '../../../core/api/commande-client/commande-client.model';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { SessionCaisse } from '../../../core/api/session-caisse/session-caisse.model';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { Caisse } from '../../../core/api/caisse/caisse.model';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

const PAR_PAGE = 50;

/** Un mode de paiement et ce qu'il a encaissé sur la page affichée. */
interface LigneVentilation {
  libelle: string;
  montant: number;
  pourboire: number;
  notes: number;
}

/**
 * Les ventes d'une session de caisse : ce que le poste a encaissé, note par note.
 *
 * C'était le trou du parcours. Une note réglée quittait la file « À encaisser »
 * et n'apparaissait plus nulle part : la prise de commande ne liste que les
 * statuts vivants, et le module Pilotage — qui agrège le chiffre d'affaires —
 * est fermé au caissier, qui n'a aucune permission `reporting.*`. Le seul moyen
 * de revoir une note encaissée était d'en connaître l'identifiant.
 *
 * Le périmètre est la SESSION, pas la journée : le service d'un restaurant
 * dépasse minuit, et une journée calendaire couperait un service en deux.
 */
@Component({
  selector: 'app-ventes-page',
  standalone: true,
  imports: [DatePipe, RouterLink, SiteRequisComponent, MontantPipe],
  templateUrl: './ventes.page.html',
  styleUrls: ['./caisse.page.scss', './encaissement.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentesPage implements OnInit {
  private readonly commandeService = inject(CommandeClientService);
  private readonly sessionService = inject(SessionCaisseService);
  private readonly caisseService = inject(CaisseService);
  private readonly pdfService = inject(PdfService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly allCaisses = signal<Caisse[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;

  readonly caisses = computed(() => {
    const siteId = this.selectedSite.selectedId();

    return siteId === null
      ? []
      : this.allCaisses().filter((c) => c.point_de_vente?.site_id === siteId);
  });
  readonly selectedCaisseId = signal<number | null>(null);

  readonly sessions = signal<SessionCaisse[]>([]);
  readonly selectedSessionId = signal<number | null>(null);
  readonly sessionCourante = computed(
    () => this.sessions().find((s) => s.id === this.selectedSessionId()) ?? null,
  );

  readonly ventes = signal<CommandeClient[]>([]);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(true);
  readonly loadingVentes = signal(false);
  readonly pdfBusy = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Total de la PAGE affichée, jamais de la session : additionner 50 notes sur
   * 120 et annoncer le résultat comme « total encaissé » serait un faux chiffre
   * dans un écran d'argent. Le nombre de notes de la session, lui, vient du
   * compte de l'API.
   */
  readonly totalPage = computed(() =>
    this.ventes().reduce((total, c) => total + Number(c.montant_du), 0),
  );

  readonly totalSession = computed(() => this.pagination()?.total ?? 0);

  /** Pourboires de la page, à reverser aux serveurs. */
  readonly totalPourboires = computed(() =>
    this.ventilation().reduce((total, mode) => total + mode.pourboire, 0),
  );
  readonly pageUnique = computed(() => (this.pagination()?.derniere_page ?? 1) <= 1);

  /**
   * Ce que chaque mode a encaissé sur la page. Utile pour préparer le
   * rapprochement : seul l'argent des modes en espèces se retrouve dans le
   * tiroir qu'on compte à la fermeture.
   */
  readonly ventilation = computed<LigneVentilation[]>(() => {
    const parMode = new Map<string, LigneVentilation>();

    for (const vente of this.ventes()) {
      for (const paiement of vente.paiements ?? []) {
        const libelle = paiement.mode_de_paiement?.libelle ?? 'Non précisé';
        const ligne = parMode.get(libelle) ?? { libelle, montant: 0, pourboire: 0, notes: 0 };
        // Recette et pourboire restent séparés : le second est dans le tiroir
        // mais n'appartient pas à l'établissement.
        ligne.montant += Number(paiement.montant);
        ligne.pourboire += Number(paiement.pourboire ?? 0);
        ligne.notes += 1;
        parMode.set(libelle, ligne);
      }
    }

    return [...parMode.values()].sort((a, b) => b.montant - a.montant);
  });

  constructor() {
    effect(() => {
      const list = this.caisses();
      const courant = untracked(() => this.selectedCaisseId());
      if (courant !== null && list.some((c) => c.id === courant)) {
        return;
      }
      const suivant = list[0]?.id ?? null;
      this.selectedCaisseId.set(suivant);
      this.chargerSessions(suivant);
    });
  }

  ngOnInit(): void {
    this.caisseService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (caisses) => {
          this.allCaisses.set(caisses);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onCaisseChange(valeur: string): void {
    const id = Number(valeur);
    this.selectedCaisseId.set(id);
    this.chargerSessions(id);
  }

  onSessionChange(valeur: string): void {
    const id = Number(valeur);
    this.selectedSessionId.set(id);
    this.charger(id, 1);
  }

  allerPage(page: number): void {
    const sessionId = this.selectedSessionId();
    if (sessionId !== null) {
      this.charger(sessionId, page);
    }
  }

  /** Réimpression du reçu : le client qui revient le réclamer, à la caisse. */
  imprimerRecu(vente: CommandeClient): void {
    if (this.pdfBusy()) {
      return;
    }
    this.pdfBusy.set(true);
    this.error.set(null);
    this.ouvrir(this.pdfService.recuClient(vente.id), `recu-${vente.id}.pdf`);
  }

  private ouvrir(source: Observable<Blob>, nomFichier: string): void {
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.pdfBusy.set(false);
        ouvrirPdfDansOnglet(blob, nomFichier);
      },
      error: (err: HttpErrorResponse) => {
        this.pdfBusy.set(false);
        this.error.set(apiErrorMessage(err, 'Impression impossible.'));
      },
    });
  }

  /**
   * Sessions de la caisse, la plus récente d'abord : on consulte les ventes du
   * service en cours bien plus souvent que celles d'avant-hier.
   */
  private chargerSessions(caisseId: number | null): void {
    if (caisseId === null) {
      this.sessions.set([]);
      this.selectedSessionId.set(null);
      this.ventes.set([]);

      return;
    }
    this.sessionService
      .list(caisseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          const triees = [...sessions].sort(
            (a, b) => new Date(b.ouvert_le).getTime() - new Date(a.ouvert_le).getTime(),
          );
          this.sessions.set(triees);
          const courante = triees.find((s) => s.statut === 'ouverte') ?? triees[0] ?? null;
          this.selectedSessionId.set(courante?.id ?? null);
          if (courante) {
            this.charger(courante.id, 1);
          } else {
            this.ventes.set([]);
            this.pagination.set(null);
          }
        },
        error: () => this.sessions.set([]),
      });
  }

  private charger(sessionId: number, page: number): void {
    this.loadingVentes.set(true);
    this.error.set(null);
    this.commandeService
      .listPagine({
        session_caisse_id: sessionId,
        statut: ['encaissee'],
        avec_paiements: true,
        per_page: PAR_PAGE,
        page,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.ventes.set(resultat.commandes);
          this.pagination.set(resultat.pagination);
          this.loadingVentes.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingVentes.set(false);
          this.error.set(apiErrorMessage(err, 'Chargement des ventes impossible.'));
        },
      });
  }
}
