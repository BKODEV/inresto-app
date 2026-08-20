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
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { SousRecetteService } from '../../../core/api/sous-recette/sous-recette.service';
import { LigneSousRecette, SousRecette } from '../../../core/api/sous-recette/sous-recette.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { QuantitePipe } from '../../../shared/format/nombre.pipes';

@Component({
  selector: 'app-sous-recettes-page',
  standalone: true,
  imports: [ReactiveFormsModule, QuantitePipe],
  templateUrl: './sous-recettes.page.html',
  styleUrl: './sous-recettes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SousRecettesPage implements OnInit {
  private readonly service = inject(SousRecetteService);
  private readonly matiereService = inject(MatierePremiereService);
  private readonly uniteService = inject(UniteDeMesureService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<SousRecette[]>([]);
  readonly matieres = signal<MatierePremiere[]>([]);
  readonly unites = signal<UniteDeMesure[]>([]);
  readonly loading = signal(true);

  readonly drawerOpen = signal(false);
  readonly editingItem = signal<SousRecette | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly lignes = signal<FormGroup[]>([]);

  readonly canManage = computed(() => this.auth.hasPermission('sousrecette.create'));
  readonly canDelete = computed(() => this.auth.hasPermission('sousrecette.delete'));

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    quantite_produite: [null as number | null, [Validators.required, Validators.min(0.001)]],
    unite_id: [null as number | null, [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
    this.matiereService
      .list({ statut: 'actif' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.matieres.set(data));
    this.uniteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.unites.set(data));
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  uniteSymbole(uniteId: number): string {
    return this.unites().find((u) => u.id === uniteId)?.symbole ?? '—';
  }

  formatMontant(value: string): string {
    return this.montantFormatter.format(Number(value));
  }

  private ligneGroup(ligne?: LigneSousRecette): FormGroup {
    return this.fb.group({
      matiere_premiere_id: [ligne?.matiere_premiere_id ?? null, [Validators.required]],
      quantite: [
        ligne ? Number(ligne.quantite) : null,
        [Validators.required, Validators.min(0.001)],
      ],
    });
  }

  /**
   * Symbole de l'unité de STOCKAGE de la matière sélectionnée sur la ligne.
   * L'unité d'une ligne n'est jamais choisie : elle est imposée par la matière
   * (aucune conversion dimensionnelle serveur). Affichée en lecture seule.
   * NB : distincte de l'unité produite de la sous-recette (champ d'entête).
   */
  uniteStockageSymbole(group: FormGroup): string {
    const matiereId = group.get('matiere_premiere_id')?.value as number | null;
    if (matiereId === null) {
      return '—';
    }
    const matiere = this.matieres().find((m) => m.id === matiereId);
    if (!matiere) {
      return '—';
    }
    return (
      matiere.unite?.symbole ??
      this.unites().find((u) => u.id === matiere.unite_de_mesure_id)?.symbole ??
      '—'
    );
  }

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({ libelle: '', quantite_produite: null, unite_id: null });
    this.lignes.set([this.ligneGroup()]);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: SousRecette): void {
    this.editingItem.set(item);
    this.form.reset({
      libelle: item.libelle,
      quantite_produite: Number(item.quantite_produite),
      unite_id: item.unite_id,
    });
    const lignes = item.lignes ?? [];
    this.lignes.set(lignes.length ? lignes.map((l) => this.ligneGroup(l)) : [this.ligneGroup()]);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  addLigne(): void {
    this.lignes.update((list) => [...list, this.ligneGroup()]);
  }

  removeLigne(group: FormGroup): void {
    this.lignes.update((list) => list.filter((g) => g !== group));
  }

  save(): void {
    const groups = this.lignes();
    if (
      this.form.invalid ||
      groups.length === 0 ||
      groups.some((g) => g.invalid) ||
      this.saving()
    ) {
      this.form.markAllAsTouched();
      groups.forEach((g) => g.markAllAsTouched());
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      libelle: raw.libelle,
      quantite_produite: raw.quantite_produite!,
      unite_id: raw.unite_id!,
      lignes: groups.map((g) => ({
        matiere_premiere_id: g.value.matiere_premiere_id as number,
        quantite: g.value.quantite as number,
      })),
    };
    const editing = this.editingItem();
    const request$ = editing
      ? this.service.update(editing.id, payload)
      : this.service.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  delete(item: SousRecette): void {
    if (!confirm(`Supprimer la sous-recette « ${item.libelle} » ?`)) {
      return;
    }
    this.deletingId.set(item.id);
    this.service
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) => list.filter((i) => i.id !== item.id));
          this.deletingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          // 409 : sous-recette utilisée par une fiche active.
          alert(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}
