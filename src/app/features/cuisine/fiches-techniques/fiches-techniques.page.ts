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
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { FicheTechniqueService } from '../../../core/api/fiche-technique/fiche-technique.service';
import { FicheTechnique } from '../../../core/api/fiche-technique/fiche-technique.model';
import { AuthService } from '../../../core/auth/auth.service';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Liste des fiches techniques ACTIVES : consultation, impression et accès au
 * produit. La création/édition se fait depuis le détail du produit (une fiche
 * n'existe pas sans produit) — voir ProduitDetailPage.
 */
@Component({
  selector: 'app-fiches-techniques-page',
  standalone: true,
  imports: [],
  templateUrl: './fiches-techniques.page.html',
  styleUrl: './fiches-techniques.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FichesTechniquesPage implements OnInit {
  private readonly service = inject(FicheTechniqueService);
  private readonly auth = inject(AuthService);
  private readonly pdfService = inject(PdfService);
  private readonly selectedSite = inject(SelectedSiteService);

  /** En vue consolidée il n'y a pas de site, donc pas d'en-tête à imprimer. */
  readonly estConsolide = this.selectedSite.estConsolide;
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<FicheTechnique[]>([]);
  readonly loading = signal(true);
  readonly deletingId = signal<number | null>(null);
  readonly pdfBusyId = signal<number | null>(null);

  // Historique
  readonly historiqueOpen = signal(false);
  readonly historique = signal<FicheTechnique[]>([]);
  readonly historiqueLoading = signal(false);
  readonly historiqueProduit = signal<string>('');

  readonly canDelete = computed(() => this.auth.hasPermission('fichetechnique.delete'));

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');

  ngOnInit(): void {
    this.load();
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

  // ── Helpers ─────────────────────────────────────────────────────────────

  produitLibelle(fiche: FicheTechnique): string {
    return fiche.produit?.libelle ?? `Produit #${fiche.produit_id}`;
  }

  formatMontant(value: string): string {
    return this.montantFormatter.format(Number(value));
  }

  statutBadge(statut: string): string {
    return statut === 'active' ? 'badge-active' : 'badge-archivee';
  }

  /** Ouvre le détail du produit (où l'on crée/modifie la fiche). */
  openProduit(fiche: FicheTechnique): void {
    this.router.navigate(['/cuisine/produits', fiche.produit_id]);
  }

  /** Ouvre la fiche technique en PDF (impression atelier). */
  imprimerPdf(fiche: FicheTechnique): void {
    if (this.pdfBusyId() !== null) {
      return;
    }
    this.pdfBusyId.set(fiche.id);
    this.pdfService
      .ficheTechnique(fiche.id, this.selectedSite.selectedId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          ouvrirPdfDansOnglet(blob, `fiche-technique-${fiche.id}.pdf`);
          this.pdfBusyId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.pdfBusyId.set(null);
          alert(apiErrorMessage(err, 'Génération du PDF impossible.'));
        },
      });
  }

  delete(item: FicheTechnique): void {
    if (!confirm(`Supprimer la fiche technique de « ${this.produitLibelle(item)} » ?`)) {
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
          alert(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }

  // ── Historique ──────────────────────────────────────────────────────────

  openHistorique(item: FicheTechnique): void {
    this.historiqueProduit.set(this.produitLibelle(item));
    this.historique.set([]);
    this.historiqueLoading.set(true);
    this.historiqueOpen.set(true);
    this.service
      .historique(item.produit_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.historique.set(data);
          this.historiqueLoading.set(false);
        },
        error: () => this.historiqueLoading.set(false),
      });
  }

  closeHistorique(): void {
    this.historiqueOpen.set(false);
  }
}
