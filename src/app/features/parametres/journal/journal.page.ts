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

import { JournalService } from '../../../core/api/journal/journal.service';
import { EvenementJournal, TypeEvenementJournal } from '../../../core/api/journal/journal.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { formatMontant } from '../../../shared/format/nombre.format';

interface TypeOption {
  value: TypeEvenementJournal;
  label: string;
}

const TYPES: TypeOption[] = [
  { value: 'annulation', label: 'Annulations' },
  { value: 'remise', label: 'Remises' },
  { value: 'paiement', label: 'Paiements' },
  { value: 'encaissement', label: 'Clôtures de note' },
  { value: 'versement', label: 'Versements' },
  { value: 'impression', label: 'Impressions' },
];

/**
 * Journal d'activité — lecture seule.
 *
 * N'affiche rien qui ne soit déjà enregistré ailleurs : l'écran relit les
 * traces que chaque module produit avec son contexte métier (motif d'annulation,
 * sort du stock, mode de paiement…). C'est une vue, pas une source.
 */
@Component({
  selector: 'app-journal-page',
  standalone: true,
  templateUrl: './journal.page.html',
  styleUrl: './journal.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalPage implements OnInit {
  private readonly service = inject(JournalService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = TYPES;
  readonly evenements = signal<EvenementJournal[]>([]);
  readonly loading = signal(true);

  /**
   * La fenêtre réellement lue par l'API, et le volume retenu. Sans dates
   * fournies elle se ramène à la journée courante, et chaque source est
   * plafonnée : l'afficher évite de croire qu'on tient tout l'historique.
   */
  readonly periode = signal<{ debut: string; fin: string } | null>(null);
  readonly total = signal(0);

  /**
   * Un site porte plusieurs comptoirs, et une anomalie se cherche sur le
   * comptoir où elle a eu lieu. Le filtre est servi par l'API depuis toujours.
   */
  readonly pointsDeVente = signal<PointDeVente[]>([]);
  readonly pointDeVenteId = signal<number | null>(null);

  private readonly aujourdhui = new Date().toISOString().slice(0, 10);
  readonly dateDebut = signal(this.aujourdhui);
  readonly dateFin = signal(this.aujourdhui);
  readonly typesActifs = signal<Set<TypeEvenementJournal>>(new Set());

  readonly typeLabel: Record<TypeEvenementJournal, string> = {
    annulation: 'Annulation',
    remise: 'Remise',
    paiement: 'Paiement',
    encaissement: 'Clôture',
    versement: 'Versement',
    impression: 'Impression',
  };

  readonly aDesFiltres = computed(
    () => this.typesActifs().size > 0 || this.pointDeVenteId() !== null,
  );

  private readonly horodatage = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  constructor() {
    // Le périmètre borne ce que l'API renvoie : changer de site doit recharger.
    // Le comptoir choisi appartenait au site précédent : le garder filtrerait
    // sur un point de vente absent de la nouvelle portée, donc sur du vide.
    effect(() => {
      this.selectedSite.epoch();
      this.pointDeVenteId.set(null);
      this.chargerPointsDeVente();
      this.charger();
    });
  }

  ngOnInit(): void {
    this.chargerPointsDeVente();
    this.charger();
  }

  onDateDebut(valeur: string): void {
    this.dateDebut.set(valeur);
    this.charger();
  }

  onDateFin(valeur: string): void {
    this.dateFin.set(valeur);
    this.charger();
  }

  basculerType(type: TypeEvenementJournal): void {
    this.typesActifs.update((actifs) => {
      const suivant = new Set(actifs);
      if (suivant.has(type)) {
        suivant.delete(type);
      } else {
        suivant.add(type);
      }
      return suivant;
    });
    this.charger();
  }

  estActif(type: TypeEvenementJournal): boolean {
    return this.typesActifs().has(type);
  }

  onPointDeVente(valeur: string): void {
    this.pointDeVenteId.set(valeur === '' ? null : Number(valeur));
    this.charger();
  }

  /** Horodatage à la seconde : deux gestes d'un même service se suivent de près. */
  horodate(valeur: string | null): string {
    return valeur === null ? '—' : this.horodatage.format(new Date(valeur));
  }

  montant(valeur: number | null): string {
    return valeur === null ? '' : formatMontant(valeur);
  }

  private charger(): void {
    this.loading.set(true);
    this.service
      .list({
        date_debut: this.dateDebut(),
        date_fin: this.dateFin(),
        type: [...this.typesActifs()],
        site_id: this.selectedSite.selectedId() ?? undefined,
        point_de_vente_id: this.pointDeVenteId() ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (index) => {
          this.evenements.set(index.evenements);
          this.periode.set(index.periode);
          this.total.set(index.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  /**
   * Restreint au site courant : les points de vente des autres sites ne sont
   * pas dans le périmètre lu, les proposer ne filtrerait que sur du vide.
   */
  private chargerPointsDeVente(): void {
    const siteId = this.selectedSite.selectedId();
    this.pdvService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (liste) =>
          this.pointsDeVente.set(
            siteId === null ? liste : liste.filter((p) => p.site_id === siteId),
          ),
        error: () => this.pointsDeVente.set([]),
      });
  }
}
