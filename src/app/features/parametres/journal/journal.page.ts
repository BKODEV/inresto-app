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
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = TYPES;
  readonly evenements = signal<EvenementJournal[]>([]);
  readonly loading = signal(true);

  private readonly aujourdhui = new Date().toISOString().slice(0, 10);
  readonly dateDebut = signal(this.aujourdhui);
  readonly dateFin = signal(this.aujourdhui);
  readonly typesActifs = signal<Set<TypeEvenementJournal>>(new Set());

  readonly typeLabel: Record<TypeEvenementJournal, string> = {
    annulation: 'Annulation',
    remise: 'Remise',
    paiement: 'Paiement',
    encaissement: 'Clôture',
    impression: 'Impression',
  };

  readonly aDesFiltres = computed(() => this.typesActifs().size > 0);

  private readonly horodatage = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  constructor() {
    // Le périmètre borne ce que l'API renvoie : changer de site doit recharger.
    effect(() => {
      this.selectedSite.epoch();
      this.charger();
    });
  }

  ngOnInit(): void {
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
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evenements) => {
          this.evenements.set(evenements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
