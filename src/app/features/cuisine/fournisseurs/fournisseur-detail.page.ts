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
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FournisseurService } from '../../../core/api/fournisseur/fournisseur.service';
import { Fournisseur } from '../../../core/api/fournisseur/fournisseur.model';
import { CatalogueFournisseurService } from '../../../core/api/catalogue-fournisseur/catalogue-fournisseur.service';
import { CatalogueFournisseur } from '../../../core/api/catalogue-fournisseur/catalogue-fournisseur.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { ApiErrorResponse } from '../../../core/api/api.types';

@Component({
  selector: 'app-fournisseur-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './fournisseur-detail.page.html',
  styleUrl: './fournisseur-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FournisseurDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FournisseurService);
  private readonly catalogueService = inject(CatalogueFournisseurService);
  private readonly matiereService = inject(MatierePremiereService);
  private readonly uniteService = inject(UniteDeMesureService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private fournisseurId!: number;

  readonly fournisseur = signal<Fournisseur | null>(null);
  readonly lignes = signal<CatalogueFournisseur[]>([]);
  readonly matieres = signal<MatierePremiere[]>([]);
  readonly unites = signal<UniteDeMesure[]>([]);
  readonly loading = signal(true);

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  /** Liste éditable du drawer — pilotée par signal (app zoneless). */
  readonly entries = signal<FormGroup[]>([]);

  /** Erreurs renvoyées par le serveur, indexées par n° de ligne (lignes.{i}.*). */
  readonly lineErrors = signal<Record<number, string>>({});

  readonly initials = computed(() => {
    const nom = this.fournisseur()?.nom ?? '';
    const parts = nom.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '—';
    }
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  });

  private readonly prixFormatter = new Intl.NumberFormat('fr-FR');
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  ngOnInit(): void {
    this.fournisseurId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
    this.matiereService
      .list()
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
      .get(this.fournisseurId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.fournisseur.set(data),
        error: () => this.loading.set(false),
      });
    this.catalogueService
      .list({ fournisseur_id: this.fournisseurId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.lignes.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  formatPrix(value: string): string {
    return this.prixFormatter.format(Number(value));
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  matiereLibelle(ligne: CatalogueFournisseur): string {
    return (
      ligne.matiere_premiere?.libelle ??
      this.matieres().find((m) => m.id === ligne.matiere_premiere_id)?.libelle ??
      '—'
    );
  }

  uniteSymbole(ligne: CatalogueFournisseur): string {
    return (
      ligne.unite_achat?.symbole ??
      this.unites().find((u) => u.id === ligne.unite_achat_id)?.symbole ??
      '—'
    );
  }

  // ── Drawer d'édition du catalogue ───────────────────────────────────────

  private ligneGroup(ligne?: CatalogueFournisseur): FormGroup {
    return this.fb.group({
      matiere_premiere_id: [ligne?.matiere_premiere_id ?? null, [Validators.required]],
      prix_unitaire: [
        ligne ? Number(ligne.prix_unitaire) : null,
        [Validators.required, Validators.min(0)],
      ],
      unite_achat_id: [ligne?.unite_achat_id ?? null, [Validators.required]],
      qte_par_unite_achat: [
        ligne ? Number(ligne.qte_par_unite_achat) : null,
        [Validators.required, Validators.min(0.0001)],
      ],
    });
  }

  openManage(): void {
    const existantes = this.lignes();
    const groups = existantes.length
      ? existantes.map((l) => this.ligneGroup(l))
      : [this.ligneGroup()];
    this.entries.set(groups);
    this.formError.set(null);
    this.lineErrors.set({});
    this.drawerOpen.set(true);
  }

  addLigne(): void {
    this.entries.update((list) => [...list, this.ligneGroup()]);
    // Les index changent : on repart d'erreurs serveur propres.
    this.lineErrors.set({});
  }

  removeLigne(group: FormGroup): void {
    this.entries.update((list) => list.filter((g) => g !== group));
    this.lineErrors.set({});
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /**
   * Vrai si cette matière est déjà sélectionnée sur une AUTRE ligne — sert à
   * désactiver l'option dans les `<select>` concurrents pour empêcher le doublon
   * en amont (le backend le rejette aussi via la règle `distinct`).
   */
  matiereDejaSelectionnee(matiereId: number, current: FormGroup): boolean {
    return this.entries().some(
      (g) => g !== current && g.get('matiere_premiere_id')?.value === matiereId,
    );
  }

  /** Sélection d'une matière : on efface l'erreur serveur de la ligne touchée. */
  onMatiereChange(index: number): void {
    if (this.lineErrors()[index]) {
      this.lineErrors.update((map) => {
        const copie = { ...map };
        delete copie[index];
        return copie;
      });
    }
    this.formError.set(null);
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    const groups = this.entries();
    if (groups.some((g) => g.invalid)) {
      groups.forEach((g) => g.markAllAsTouched());
      return;
    }

    const payload = groups.map((g) => ({
      matiere_premiere_id: g.value.matiere_premiere_id as number,
      prix_unitaire: g.value.prix_unitaire as number,
      unite_achat_id: g.value.unite_achat_id as number,
      qte_par_unite_achat: g.value.qte_par_unite_achat as number,
    }));

    // Garde-fou client : une matière en double bloque avant l'appel et signale
    // la ou les lignes fautives (le backend rejette aussi via la règle distinct).
    const doublons = this.indexesEnDoublon(payload.map((p) => p.matiere_premiere_id));
    if (doublons.size > 0) {
      this.marquerLignesEnDoublon(doublons);
      this.formError.set('Une même matière première ne peut figurer deux fois dans le catalogue.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.lineErrors.set({});

    this.catalogueService
      .sync(this.fournisseurId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogue) => {
          this.lignes.set(catalogue);
          this.saving.set(false);
          this.drawerOpen.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.appliquerErreursServeur(err);
          this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }

  /** Index (0-based) des lignes dont la matière apparaît plus d'une fois. */
  private indexesEnDoublon(matiereIds: (number | null)[]): Set<number> {
    const doublons = new Set<number>();
    matiereIds.forEach((id, index) => {
      if (id !== null && matiereIds.indexOf(id) !== index) {
        doublons.add(index);
        doublons.add(matiereIds.indexOf(id));
      }
    });
    return doublons;
  }

  private marquerLignesEnDoublon(indexes: Set<number>): void {
    const map: Record<number, string> = {};
    indexes.forEach((index) => {
      map[index] = 'Cette matière est déjà sélectionnée sur une autre ligne.';
    });
    this.lineErrors.set(map);
  }

  /**
   * Mappe les erreurs 422 `lignes.{i}.champ` vers la ligne correspondante du
   * drawer pour un affichage inline (en plus de l'alerte globale).
   */
  private appliquerErreursServeur(err: HttpErrorResponse): void {
    const erreurs = (err.error as ApiErrorResponse | null)?.errors ?? {};
    const map: Record<number, string> = {};
    for (const [cle, messages] of Object.entries(erreurs)) {
      const correspondance = cle.match(/^lignes\.(\d+)\./);
      if (correspondance && messages.length > 0) {
        const index = Number(correspondance[1]);
        map[index] ??= messages[0];
      }
    }
    this.lineErrors.set(map);
  }
}
