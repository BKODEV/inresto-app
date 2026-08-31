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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CarteService } from '../../../core/api/carte/carte.service';
import { Carte, CarteStatut } from '../../../core/api/carte/carte.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

@Component({
  selector: 'app-cartes-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SiteRequisComponent],
  templateUrl: './cartes.page.html',
  styleUrl: './cartes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartesPage implements OnInit {
  private readonly carteService = inject(CarteService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  // Cartes + PDV restreints au site global (via le PDV de chaque carte).
  private readonly allItems = signal<Carte[]>([]);
  private readonly allPdvs = signal<PointDeVente[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly items = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null
      ? []
      : this.allItems().filter((c) => c.point_de_vente?.site_id === siteId);
  });
  readonly pointsDeVente = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Carte | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    point_de_vente_id: [0, [Validators.required, Validators.min(1)]],
    statut: ['brouillon' as CarteStatut],
  });

  constructor() {
    // Le contenu du tiroir appartient au site quitté : changer de périmètre le
    // ferme plutôt que d'enregistrer une saisie sur le mauvais site.
    effect(() => {
      this.selectedSite.epoch();
      this.drawerOpen.set(false);
    });
  }

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      cartes: this.carteService.list(),
      pdv: this.pdvService.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cartes, pdv }) => {
          this.allItems.set(cartes);
          this.allPdvs.set(pdv);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openCreate(): void {
    this.editingItem.set(null);
    // Pré-sélectionne le premier PDV du site courant.
    this.form.reset({
      libelle: '',
      point_de_vente_id: this.pointsDeVente()[0]?.id ?? 0,
      statut: 'brouillon',
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Carte): void {
    this.editingItem.set(item);
    this.form.reset({
      libelle: item.libelle,
      point_de_vente_id: item.point_de_vente_id,
      statut: item.statut,
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const payload = this.form.getRawValue();
    const editing = this.editingItem();

    const request$ = editing
      ? this.carteService.update(editing.id, payload)
      : this.carteService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          this.allItems.update((list) => list.map((i) => (i.id === saved.id ? saved : i)));
        } else {
          this.allItems.update((list) => [...list, saved]);
        }
        this.saving.set(false);
        this.drawerOpen.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  async delete(item: Carte): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(item.libelle, { nature: 'la carte' }))) {
      return;
    }
    this.deletingId.set(item.id);
    this.carteService
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allItems.update((list) => list.filter((i) => i.id !== item.id));
          this.deletingId.set(null);
        },
        error: () => this.deletingId.set(null),
      });
  }

  readonly statutLabel: Record<CarteStatut, string> = {
    brouillon: 'Brouillon',
    active: 'Active',
    archivee: 'Archivée',
  };
}
