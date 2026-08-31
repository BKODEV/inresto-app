import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { ReportingFilter } from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { formatMontant, formatPourcentage } from '../../../shared/format/nombre.format';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { plageDeReporting } from '../shared/periode-plage';

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
  imports: [DatePipe, RouterLink, PeriodeFiltre],
  templateUrl: './remises.page.html',
  styleUrl: './audit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemisesPage {
  private readonly service = inject(AuditService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly remises = signal<RemiseAudit[]>([]);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * Posé par la barre de période, qui émet dès son initialisation : c'est cette
   * première émission qui déclenche le chargement, d'où l'absence de `ngOnInit`.
   */
  readonly filtre = signal<ReportingFilter | null>(null);
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
    // Une seule source de chargement : la période, le type, la page et le
    // périmètre décrivent ensemble la question posée. Les gestes de l'écran ne
    // font que poser un signal — les appeler ET laisser l'effet réagir, comme
    // auparavant, lançait deux fois la même requête.
    effect(() => {
      this.selectedSite.epoch();
      const filtre = this.filtre();
      const type = this.type();
      const page = this.page();

      if (filtre) {
        this.charger(filtre, type, page);
      }
    });
  }

  onPeriode(filtre: ReportingFilter): void {
    this.page.set(1);
    this.filtre.set(filtre);
  }

  onType(valeur: string): void {
    this.page.set(1);
    this.type.set(valeur === '' ? null : (valeur as TypeRemise));
  }

  allerPage(page: number): void {
    this.page.set(page);
  }

  /** Un pourcentage et un montant ne se lisent pas avec la même unité. */
  valeur(remise: RemiseAudit): string {
    return remise.type === 'pourcentage'
      ? formatPourcentage(Number(remise.valeur))
      : formatMontant(Number(remise.valeur));
  }

  readonly fMontant = formatMontant;

  private charger(filtre: ReportingFilter, type: TypeRemise | null, page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .remises({
        ...plageDeReporting(filtre),
        type: type ?? undefined,
        site_id: this.selectedSite.selectedId() ?? undefined,
        page,
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
