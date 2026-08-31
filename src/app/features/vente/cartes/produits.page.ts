import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Statut } from '../../../core/api/api.types';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { ProduitService } from '../../../core/api/produit/produit.service';
import { Produit } from '../../../core/api/produit/produit.model';
import { CategorieProduitService } from '../../../core/api/categorie-produit/categorie-produit.service';
import { CategorieProduit } from '../../../core/api/categorie-produit/categorie-produit.model';
import { redimensionnerImage } from '../../../core/media/redimensionner-image';
import { AlerteService } from '../../../core/alertes/alerte.service';

@Component({
  selector: 'app-produits-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './produits.page.html',
  styleUrl: './cartes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProduitsPage implements OnInit {
  private readonly produitService = inject(ProduitService);
  private readonly categorieService = inject(CategorieProduitService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly items = signal<Produit[]>([]);
  readonly categories = signal<CategorieProduit[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Produit | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  // Photo du produit : le seul visuel que voit le client sur le menu public.
  readonly photoBusy = signal(false);
  readonly photoError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    categorie_id: [0, [Validators.required, Validators.min(1)]],
    description: [''],
    allergenes: [''],
    est_menu: [false],
    statut: ['actif' as Statut],
  });

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      produits: this.produitService.list(),
      categories: this.categorieService.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ produits, categories }) => {
          this.items.set(produits);
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  categorieLabel(id: number): string {
    return this.categories().find((c) => c.id === id)?.libelle ?? '—';
  }

  /** Ouvre la fiche produit (détail + fiche technique). */
  open(item: Produit): void {
    this.router.navigate(['/cuisine/produits', item.id]);
  }

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({
      libelle: '',
      categorie_id: 0,
      description: '',
      allergenes: '',
      est_menu: false,
      statut: 'actif',
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Produit): void {
    this.photoError.set(null);
    this.editingItem.set(item);
    this.form.reset({
      libelle: item.libelle,
      categorie_id: item.categorie_id,
      description: item.description ?? '',
      allergenes: item.allergenes ?? '',
      est_menu: item.est_menu,
      statut: item.statut,
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /**
   * Téléverse la photo du produit en cours d'édition.
   *
   * L'image est réduite dans le navigateur avant l'envoi : le menu public est
   * consulté au téléphone, souvent en réseau lent, et une photo d'appareil brute
   * pèse plusieurs mégaoctets.
   */
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = ''; // autorise le re-choix du même fichier
    const produit = this.editingItem();

    if (!fichier || produit === null) {
      return;
    }

    this.photoBusy.set(true);
    this.photoError.set(null);

    redimensionnerImage(fichier).then((allege) => {
      this.produitService
        .uploadPhoto(produit.id, allege)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (saved) => this.appliquerPhoto(saved),
          error: (err: HttpErrorResponse) => {
            this.photoBusy.set(false);
            this.photoError.set(apiErrorMessage(err, 'Téléversement de la photo impossible.'));
          },
        });
    });
  }

  async supprimerPhoto(): Promise<void> {
    const produit = this.editingItem();
    if (this.photoBusy() || produit === null) {
      return;
    }

    const confirme = await this.alertes.confirmer({
      titre: 'Supprimer la photo de ce produit ?',
      confirmer: 'Supprimer',
      danger: true,
    });
    if (!confirme) {
      return;
    }

    this.photoBusy.set(true);
    this.photoError.set(null);
    this.produitService
      .deletePhoto(produit.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => this.appliquerPhoto(saved),
        error: (err: HttpErrorResponse) => {
          this.photoBusy.set(false);
          this.photoError.set(apiErrorMessage(err, 'Suppression de la photo impossible.'));
        },
      });
  }

  /** Répercute le produit renvoyé par l'API dans le tiroir ET dans la liste. */
  private appliquerPhoto(saved: Produit): void {
    this.editingItem.set(saved);
    this.items.update((list) => list.map((i) => (i.id === saved.id ? saved : i)));
    this.photoBusy.set(false);
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
      ? this.produitService.update(editing.id, payload)
      : this.produitService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          this.items.update((list) => list.map((i) => (i.id === saved.id ? saved : i)));
        } else {
          this.items.update((list) => [saved, ...list]);
        }
        this.saving.set(false);
        this.drawerOpen.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err));
      },
    });
  }

  async delete(item: Produit): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(item.libelle, { nature: 'le produit' }))) {
      return;
    }
    this.deletingId.set(item.id);
    this.produitService
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) => list.filter((i) => i.id !== item.id));
          this.deletingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          this.alertes.erreur(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}
