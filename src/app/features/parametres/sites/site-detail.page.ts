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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { SiteService } from '../../../core/api/site/site.service';
import { Site } from '../../../core/api/site/site.model';
import { ParametreEtablissementService } from '../../../core/api/parametre-etablissement/parametre-etablissement.service';
import { ParametreEtablissement } from '../../../core/api/parametre-etablissement/parametre-etablissement.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import {
  PointDeVente,
  PointDeVenteType,
} from '../../../core/api/point-de-vente/point-de-vente.model';
import { Statut } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { MontantPipe } from '../../../shared/format/nombre.pipes';
import { AlerteService } from '../../../core/alertes/alerte.service';

/**
 * Détail d'un site (Paramètres) : ses informations et la liste de ses points de
 * vente. Remplace l'ancien onglet « Points de vente » global — on ne gère plus
 * que les PDV du site courant, créés/modifiés/supprimés depuis cette page.
 */
@Component({
  selector: 'app-site-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, MontantPipe],
  templateUrl: './site-detail.page.html',
  styleUrl: './site-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SiteService);
  private readonly parametreService = inject(ParametreEtablissementService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly siteId = Number(this.route.snapshot.paramMap.get('id'));

  readonly site = signal<Site | null>(null);
  readonly pointsDeVente = signal<PointDeVente[]>([]);
  readonly loading = signal(true);

  // Drawer site
  readonly siteDrawerOpen = signal(false);
  readonly savingSite = signal(false);
  readonly siteError = signal<string | null>(null);

  // Drawer point de vente
  readonly pdvDrawerOpen = signal(false);
  readonly editingPdv = signal<PointDeVente | null>(null);
  readonly savingPdv = signal(false);
  readonly pdvError = signal<string | null>(null);
  readonly deletingPdvId = signal<number | null>(null);

  readonly canUpdateSite = computed(() => this.auth.hasPermission('site.update'));
  readonly canCreatePdv = computed(() => this.auth.hasPermission('point-de-vente.create'));
  readonly canUpdatePdv = computed(() => this.auth.hasPermission('point-de-vente.update'));
  readonly canDeletePdv = computed(() => this.auth.hasPermission('point-de-vente.delete'));

  // Paramètres d'établissement (fiche unique du site, en-tête des documents PDF)
  readonly parametre = signal<ParametreEtablissement | null>(null);
  readonly parametreLoading = signal(true);
  readonly parametreDrawerOpen = signal(false);
  readonly savingParametre = signal(false);
  readonly parametreError = signal<string | null>(null);
  readonly logoBusy = signal(false);
  readonly logoError = signal<string | null>(null);

  readonly canViewParametre = computed(() =>
    this.auth.hasPermission('parametre_etablissement.view'),
  );
  readonly canUpdateParametre = computed(() =>
    this.auth.hasPermission('parametre_etablissement.update'),
  );

  readonly parametreForm = this.fb.nonNullable.group({
    nom_commercial: ['', [Validators.required, Validators.maxLength(255)]],
    devise: ['XOF', [Validators.required, Validators.maxLength(10)]],
    tolerance_ecart_caisse: [0, [Validators.min(0)]],
    slogan: [''],
    adresse: [''],
    telephone: [''],
    email: ['', [Validators.email]],
    site_web: [''],
    raison_sociale: [''],
    ncc: [''],
    rccm: [''],
    regime_fiscal: [''],
    mentions_pied_page: [''],
  });

  readonly siteForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    adresse: [''],
    statut: ['actif' as Statut],
  });

  readonly pdvForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(255)]],
    type: ['Restaurant' as PointDeVenteType, [Validators.required]],
    description: [''],
    statut: ['actif' as Statut],
  });

  ngOnInit(): void {
    this.load();
    if (this.canViewParametre()) {
      this.loadParametre();
    } else {
      this.parametreLoading.set(false);
    }
  }

  // ── Paramètres d'établissement ──────────────────────────────────────────────

  private loadParametre(): void {
    this.parametreLoading.set(true);
    this.parametreService
      .get(this.siteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (parametre) => {
          this.parametre.set(parametre);
          this.parametreLoading.set(false);
        },
        // 404 = fiche non encore créée : état normal, pas une erreur.
        error: () => {
          this.parametre.set(null);
          this.parametreLoading.set(false);
        },
      });
  }

  openEditParametre(): void {
    const p = this.parametre();
    this.parametreForm.reset({
      nom_commercial: p?.nom_commercial ?? this.site()?.nom ?? '',
      devise: p?.devise ?? 'XOF',
      tolerance_ecart_caisse: Number(p?.tolerance_ecart_caisse ?? 0),
      slogan: p?.slogan ?? '',
      adresse: p?.adresse ?? this.site()?.adresse ?? '',
      telephone: p?.telephone ?? '',
      email: p?.email ?? '',
      site_web: p?.site_web ?? '',
      raison_sociale: p?.raison_sociale ?? '',
      ncc: p?.ncc ?? '',
      rccm: p?.rccm ?? '',
      regime_fiscal: p?.regime_fiscal ?? '',
      mentions_pied_page: p?.mentions_pied_page ?? '',
    });
    this.parametreError.set(null);
    this.parametreDrawerOpen.set(true);
  }

  closeParametreDrawer(): void {
    this.parametreDrawerOpen.set(false);
  }

  saveParametre(): void {
    if (this.parametreForm.invalid || this.savingParametre()) {
      this.parametreForm.markAllAsTouched();
      return;
    }
    this.savingParametre.set(true);
    this.parametreError.set(null);

    const raw = this.parametreForm.getRawValue();
    const payload = {
      nom_commercial: raw.nom_commercial,
      devise: raw.devise,
      tolerance_ecart_caisse: raw.tolerance_ecart_caisse,
      slogan: raw.slogan || null,
      adresse: raw.adresse || null,
      telephone: raw.telephone || null,
      email: raw.email || null,
      site_web: raw.site_web || null,
      raison_sociale: raw.raison_sociale || null,
      ncc: raw.ncc || null,
      rccm: raw.rccm || null,
      regime_fiscal: raw.regime_fiscal || null,
      mentions_pied_page: raw.mentions_pied_page || null,
    };

    this.parametreService
      .upsert(this.siteId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (parametre) => {
          this.parametre.set(parametre);
          this.savingParametre.set(false);
          this.parametreDrawerOpen.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.savingParametre.set(false);
          this.parametreError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise le re-choix du même fichier
    if (!file) {
      return;
    }
    this.logoBusy.set(true);
    this.logoError.set(null);
    this.parametreService
      .uploadLogo(this.siteId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (parametre) => {
          this.parametre.set(parametre);
          this.logoBusy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.logoBusy.set(false);
          this.logoError.set(apiErrorMessage(err, 'Téléversement du logo impossible.'));
        },
      });
  }

  async deleteLogo(): Promise<void> {
    if (this.logoBusy()) {
      return;
    }

    const confirme = await this.alertes.confirmer({
      titre: 'Supprimer le logo de cet établissement ?',
      confirmer: 'Supprimer',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.logoBusy.set(true);
    this.logoError.set(null);
    this.parametreService
      .deleteLogo(this.siteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (parametre) => {
          this.parametre.set(parametre);
          this.logoBusy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.logoBusy.set(false);
          this.logoError.set(apiErrorMessage(err, 'Suppression du logo impossible.'));
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .get(this.siteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (site) => {
          this.site.set(site);
          this.pointsDeVente.set(site.points_de_vente ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  // ── Site ──────────────────────────────────────────────────────────────────

  openEditSite(): void {
    const site = this.site();
    if (!site) {
      return;
    }
    this.siteForm.reset({
      nom: site.nom,
      code: site.code,
      adresse: site.adresse ?? '',
      statut: site.statut,
    });
    this.siteError.set(null);
    this.siteDrawerOpen.set(true);
  }

  closeSiteDrawer(): void {
    this.siteDrawerOpen.set(false);
  }

  saveSite(): void {
    if (this.siteForm.invalid || this.savingSite()) {
      this.siteForm.markAllAsTouched();
      return;
    }
    this.savingSite.set(true);
    this.siteError.set(null);

    const { nom, code, adresse, statut } = this.siteForm.getRawValue();
    const payload = { nom, code, adresse: adresse || null, statut };

    this.service
      .update(this.siteId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          // L'update ne renvoie pas les PDV : on conserve la liste déjà chargée.
          this.site.set({ ...saved, points_de_vente: this.pointsDeVente() });
          this.savingSite.set(false);
          this.siteDrawerOpen.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.savingSite.set(false);
          this.siteError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }

  // ── Points de vente ─────────────────────────────────────────────────────────

  openCreatePdv(): void {
    this.editingPdv.set(null);
    this.pdvForm.reset({ nom: '', type: 'Restaurant', description: '', statut: 'actif' });
    this.pdvError.set(null);
    this.pdvDrawerOpen.set(true);
  }

  openEditPdv(pdv: PointDeVente): void {
    this.editingPdv.set(pdv);
    this.pdvForm.reset({
      nom: pdv.nom,
      type: pdv.type,
      description: pdv.description ?? '',
      statut: pdv.statut,
    });
    this.pdvError.set(null);
    this.pdvDrawerOpen.set(true);
  }

  closePdvDrawer(): void {
    this.pdvDrawerOpen.set(false);
  }

  savePdv(): void {
    if (this.pdvForm.invalid || this.savingPdv()) {
      this.pdvForm.markAllAsTouched();
      return;
    }
    this.savingPdv.set(true);
    this.pdvError.set(null);

    const { nom, type, description, statut } = this.pdvForm.getRawValue();
    const payload = {
      site_id: this.siteId,
      nom,
      type,
      description: description || null,
      statut,
    };
    const editing = this.editingPdv();

    const request$ = editing
      ? this.pdvService.update(editing.id, payload)
      : this.pdvService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          // Le PATCH ne renvoie pas caisses_count : on préserve le compteur connu.
          this.pointsDeVente.update((list) =>
            list.map((p) => (p.id === saved.id ? { ...saved, caisses_count: p.caisses_count } : p)),
          );
        } else {
          // Le backend crée une caisse principale par défaut : on reflète son compteur.
          this.pointsDeVente.update((list) => [
            ...list,
            { ...saved, caisses_count: saved.caisses_count ?? 1 },
          ]);
        }
        this.syncSiteCount();
        this.savingPdv.set(false);
        this.pdvDrawerOpen.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.savingPdv.set(false);
        this.pdvError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  async deletePdv(pdv: PointDeVente): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(pdv.nom, { nature: 'le point de vente' }))) {
      return;
    }
    this.deletingPdvId.set(pdv.id);
    this.pdvService
      .delete(pdv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pointsDeVente.update((list) => list.filter((p) => p.id !== pdv.id));
          this.syncSiteCount();
          this.deletingPdvId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.deletingPdvId.set(null);
          this.alertes.erreur(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }

  private syncSiteCount(): void {
    this.site.update((s) => (s ? { ...s, points_de_vente_count: this.pointsDeVente().length } : s));
  }
}
