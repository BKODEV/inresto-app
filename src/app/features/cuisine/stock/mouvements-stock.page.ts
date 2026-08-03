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
import { HttpErrorResponse } from '@angular/common/http';

import { StockService } from '../../../core/api/stock/stock.service';
import { MouvementStock, MouvementType } from '../../../core/api/stock/mouvement-stock.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { Pagination } from '../../../core/api/api.types';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import {
  MOUVEMENT_ORIGINE_LABEL,
  MOUVEMENT_TYPE_BADGE,
  MOUVEMENT_TYPE_LABEL,
} from './mouvement-stock.labels';

/**
 * Journal des mouvements de stock du site courant : qui a fait bouger quoi,
 * quand, et depuis quelle pièce. Lecture seule — un mouvement est immuable.
 */
@Component({
  selector: 'app-mouvements-stock-page',
  standalone: true,
  imports: [SiteRequisComponent],
  templateUrl: './mouvements-stock.page.html',
  styleUrl: './mouvements-stock.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MouvementsStockPage implements OnInit {
  private readonly service = inject(StockService);
  private readonly matiereService = inject(MatierePremiereService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sites = this.selectedSite.sites;
  readonly currentSite = this.selectedSite.selectedSite;
  readonly siteLoading = this.selectedSite.loading;
  readonly estConsolide = this.selectedSite.estConsolide;

  readonly items = signal<MouvementStock[]>([]);
  readonly matieres = signal<MatierePremiere[]>([]);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(true);
  readonly listError = signal<string | null>(null);

  // Filtres
  readonly typeFilter = signal<MouvementType | ''>('');
  readonly matiereFilter = signal<number | ''>('');
  readonly dateDebut = signal('');
  readonly dateFin = signal('');
  readonly page = signal(1);

  readonly types: MouvementType[] = [
    'entree_reception',
    'sortie_vente',
    'perte',
    'casse',
    'offert',
    'repas_personnel',
    'correction_inventaire',
  ];

  readonly pagePrecedenteDisponible = computed(() => (this.pagination()?.page_courante ?? 1) > 1);
  readonly pageSuivanteDisponible = computed(() => {
    const p = this.pagination();
    return p !== null && p.page_courante < p.derniere_page;
  });

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly quantiteFormatter = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  /** Dernière portée observée, pour détecter un changement de périmètre. */
  private epochPrecedent: number | null = null;

  constructor() {
    // Recharge dès qu'un filtre, la page ou le site global change.
    effect(() => {
      const epoch = this.selectedSite.epoch();
      const site = this.selectedSite.selectedSite();
      const filtres = {
        type: this.typeFilter(),
        matiere: this.matiereFilter(),
        debut: this.dateDebut(),
        fin: this.dateFin(),
        page: this.page(),
      };

      // Changer de périmètre ramène en page 1 : rester en page 4 d'une liste
      // qui n'en compte plus qu'une afficherait un écran vide. On sort sans
      // requête — la remise à zéro relance l'effet avec la bonne page.
      if (this.epochPrecedent !== null && this.epochPrecedent !== epoch && filtres.page !== 1) {
        this.epochPrecedent = epoch;
        this.page.set(1);
        return;
      }
      this.epochPrecedent = epoch;

      if (site) {
        this.load(site.id, filtres);
      } else {
        this.items.set([]);
        this.pagination.set(null);
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

  private load(
    siteId: number,
    filtres: {
      type: MouvementType | '';
      matiere: number | '';
      debut: string;
      fin: string;
      page: number;
    },
  ): void {
    this.loading.set(true);
    this.listError.set(null);
    this.service
      .mouvements({
        site_id: siteId,
        type: filtres.type || undefined,
        matiere_premiere_id: filtres.matiere || undefined,
        date_debut: filtres.debut || undefined,
        date_fin: filtres.fin || undefined,
        page: filtres.page,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data.mouvements);
          this.pagination.set(data.pagination);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.listError.set(apiErrorMessage(err, 'Chargement des mouvements impossible.'));
        },
      });
  }

  // ── Filtres ─────────────────────────────────────────────────────────────
  // Tout changement de filtre ramène en page 1 : rester en page 5 d'un
  // résultat qui n'en compte plus que 2 afficherait une liste vide.

  onTypeFilter(value: string): void {
    this.typeFilter.set(value as MouvementType | '');
    this.page.set(1);
  }

  onMatiereFilter(value: string): void {
    this.matiereFilter.set(value ? Number(value) : '');
    this.page.set(1);
  }

  onDateDebut(value: string): void {
    this.dateDebut.set(value);
    this.page.set(1);
  }

  onDateFin(value: string): void {
    this.dateFin.set(value);
    this.page.set(1);
  }

  reinitialiserFiltres(): void {
    this.typeFilter.set('');
    this.matiereFilter.set('');
    this.dateDebut.set('');
    this.dateFin.set('');
    this.page.set(1);
  }

  pagePrecedente(): void {
    if (this.pagePrecedenteDisponible()) {
      this.page.update((p) => p - 1);
    }
  }

  pageSuivante(): void {
    if (this.pageSuivanteDisponible()) {
      this.page.update((p) => p + 1);
    }
  }

  // ── Helpers d'affichage ─────────────────────────────────────────────────

  typeLabel(type: MouvementType): string {
    return MOUVEMENT_TYPE_LABEL[type];
  }

  typeBadge(type: MouvementType): string {
    return MOUVEMENT_TYPE_BADGE[type];
  }

  /** Pièce d'origine : « Réception #42 ». Vide pour un mouvement sans origine. */
  origineLabel(mouvement: MouvementStock): string {
    if (!mouvement.reference_type) {
      return '—';
    }
    const label = MOUVEMENT_ORIGINE_LABEL[mouvement.reference_type] ?? mouvement.reference_type;
    return mouvement.reference_id ? `${label} #${mouvement.reference_id}` : label;
  }

  matiereLibelle(mouvement: MouvementStock): string {
    return mouvement.matiere_premiere?.libelle ?? `Matière #${mouvement.matiere_premiere_id}`;
  }

  uniteSymbole(mouvement: MouvementStock): string {
    const matiere = mouvement.matiere_premiere;
    return (
      matiere?.unite?.symbole ??
      this.matieres().find((m) => m.id === mouvement.matiere_premiere_id)?.unite?.symbole ??
      ''
    );
  }

  /** Signe affiché devant la quantité : la colonne quantité est toujours positive côté API. */
  signe(mouvement: MouvementStock): string {
    if (mouvement.sens === 'entree') {
      return '+';
    }
    return mouvement.sens === 'sortie' ? '−' : '';
  }

  formatQuantite(value: string): string {
    return this.quantiteFormatter.format(Number(value));
  }

  formatMontant(value: string | number): string {
    return this.montantFormatter.format(Number(value));
  }

  formatDate(value: string | null): string {
    return value ? this.dateFormatter.format(new Date(value)) : '—';
  }
}
