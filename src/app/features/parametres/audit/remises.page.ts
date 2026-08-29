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
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuditService } from '../../../core/api/audit/audit.service';
import { RemiseAudit } from '../../../core/api/audit/audit.model';
import { TypeRemise } from '../../../core/api/commande-client/commande-client.model';
import { Pagination } from '../../../core/api/api.types';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { formatMontant, formatPourcentage } from '../../../shared/format/nombre.format';

/**
 * Relecture des remises accordées — lecture seule.
 *
 * Le journal d'activité montre une remise au fil du service, plafonnée et mêlée
 * aux autres gestes. Cet écran répond à l'autre question, celle de fin de mois :
 * combien a-t-on remis, par qui, sur quels motifs.
 */
@Component({
  selector: 'app-remises-page',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './remises.page.html',
  styleUrl: './audit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemisesPage implements OnInit {
  private readonly service = inject(AuditService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly remises = signal<RemiseAudit[]>([]);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly aujourdhui = new Date().toISOString().slice(0, 10);
  readonly dateDebut = signal(this.premierDuMois());
  readonly dateFin = signal(this.aujourdhui);
  readonly type = signal<TypeRemise | null>(null);
  readonly page = signal(1);

  readonly typeLabel: Record<TypeRemise, string> = {
    pourcentage: 'Pourcentage',
    montant_fixe: 'Montant fixe',
  };

  /**
   * Le total ne se somme QUE sur les remises en montant fixe : additionner des
   * pourcentages à des francs donnerait un nombre qui ne veut rien dire. Le
   * pourcentage se rapporte au total de sa note, qui n'est pas ici.
   */
  readonly totalMontantFixe = computed(() =>
    this.remises()
      .filter((r) => r.type === 'montant_fixe')
      .reduce((acc, r) => acc + Number(r.valeur), 0),
  );

  readonly nbPourcentage = computed(
    () => this.remises().filter((r) => r.type === 'pourcentage').length,
  );

  constructor() {
    // Le périmètre borne ce que l'API renvoie : changer de site recharge.
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
    this.page.set(1);
    this.charger();
  }

  onDateFin(valeur: string): void {
    this.dateFin.set(valeur);
    this.page.set(1);
    this.charger();
  }

  onType(valeur: string): void {
    this.type.set(valeur === '' ? null : (valeur as TypeRemise));
    this.page.set(1);
    this.charger();
  }

  allerPage(page: number): void {
    this.page.set(page);
    this.charger();
  }

  /** Un pourcentage et un montant ne se lisent pas avec la même unité. */
  valeur(remise: RemiseAudit): string {
    return remise.type === 'pourcentage'
      ? formatPourcentage(Number(remise.valeur))
      : formatMontant(Number(remise.valeur));
  }

  readonly fMontant = formatMontant;

  private premierDuMois(): string {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }

  private charger(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .remises({
        date_debut: this.dateDebut(),
        date_fin: this.dateFin(),
        type: this.type() ?? undefined,
        site_id: this.selectedSite.selectedId() ?? undefined,
        page: this.page(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ lignes, pagination }) => {
          this.remises.set(lignes);
          this.pagination.set(pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger les remises.');
          this.loading.set(false);
        },
      });
  }
}
