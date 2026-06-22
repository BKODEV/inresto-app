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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { CommandeFournisseurService } from '../../../core/api/commande-fournisseur/commande-fournisseur.service';
import {
  CommandeFournisseur,
  StatutCommandeFournisseur,
} from '../../../core/api/commande-fournisseur/commande-fournisseur.model';
import { FournisseurService } from '../../../core/api/fournisseur/fournisseur.service';
import { Fournisseur } from '../../../core/api/fournisseur/fournisseur.model';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { STATUT_COMMANDE_BADGE, STATUT_COMMANDE_LABEL } from './statut-commande.labels';

@Component({
  selector: 'app-commandes-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './commandes.page.html',
  styleUrl: './commandes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandesPage implements OnInit {
  private readonly service = inject(CommandeFournisseurService);
  private readonly fournisseurService = inject(FournisseurService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<CommandeFournisseur[]>([]);
  readonly fournisseurs = signal<Fournisseur[]>([]);
  readonly loading = signal(true);
  readonly statutFilter = signal<StatutCommandeFournisseur | ''>('');

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly canCreate = computed(() => this.auth.hasPermission('commande-fournisseur.create'));

  readonly statuts: StatutCommandeFournisseur[] = [
    'brouillon',
    'envoyee',
    'partiellement_recue',
    'cloturee',
    'annulee',
  ];

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  readonly form = this.fb.nonNullable.group({
    fournisseur_id: [null as number | null, [Validators.required]],
    date_commande: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.load();
    this.fournisseurService
      .list({ statut: 'actif' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.fournisseurs.set(data));
  }

  load(): void {
    this.loading.set(true);
    const statut = this.statutFilter();
    this.service
      .list(statut ? { statut } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.commandes);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onStatutFilter(value: string): void {
    this.statutFilter.set(value as StatutCommandeFournisseur | '');
    this.load();
  }

  statutLabel(statut: StatutCommandeFournisseur): string {
    return STATUT_COMMANDE_LABEL[statut];
  }

  statutBadge(statut: StatutCommandeFournisseur): string {
    return STATUT_COMMANDE_BADGE[statut];
  }

  fournisseurNom(commande: CommandeFournisseur): string {
    return (
      commande.fournisseur?.nom ??
      this.fournisseurs().find((f) => f.id === commande.fournisseur_id)?.nom ??
      '—'
    );
  }

  formatMontant(value: string): string {
    return this.montantFormatter.format(Number(value));
  }

  formatDate(value: string | null): string {
    return value ? this.dateFormatter.format(new Date(value)) : '—';
  }

  openCreate(): void {
    this.form.reset({ fournisseur_id: null, date_commande: '', notes: '' });
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

    const raw = this.form.getRawValue();
    this.service
      .create({
        fournisseur_id: raw.fournisseur_id!,
        date_commande: raw.date_commande || null,
        notes: raw.notes || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (commande) => {
          this.saving.set(false);
          this.drawerOpen.set(false);
          // On bascule sur le détail pour saisir les lignes (brouillon).
          this.router.navigate(['/cuisine/commandes', commande.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }
}
