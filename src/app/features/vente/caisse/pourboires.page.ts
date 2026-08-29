import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PourboireService } from '../../../core/api/pourboire/pourboire.service';
import { SoldePourboire } from '../../../core/api/pourboire/pourboire.model';
import { VersementService } from '../../../core/api/versement/versement.service';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { Caisse } from '../../../core/api/caisse/caisse.model';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

/**
 * Ce qui reste dû à chacun sur les pourboires encaissés au comptoir.
 *
 * Un solde qui court à travers les sessions, et non l'instantané d'un service :
 * le rapport de fermeture dit ce qu'une soirée a généré, ce qui ne sert à rien
 * trois jours plus tard si personne n'a reversé.
 *
 * Le reversement se fait ici et non depuis le tiroir de versement générique :
 * le bénéficiaire y est la ligne sur laquelle on clique, sans ambiguïté ni
 * sélecteur d'utilisateur à parcourir.
 */
@Component({
  selector: 'app-pourboires-page',
  standalone: true,
  imports: [ReactiveFormsModule, SiteRequisComponent, MontantPipe],
  templateUrl: './pourboires.page.html',
  styleUrls: ['./caisse.page.scss', './encaissement.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PourboiresPage implements OnInit {
  private readonly pourboireService = inject(PourboireService);
  private readonly versementService = inject(VersementService);
  private readonly caisseService = inject(CaisseService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly allCaisses = signal<Caisse[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;

  readonly caisses = computed(() => {
    const siteId = this.selectedSite.selectedId();

    return siteId === null
      ? []
      : this.allCaisses().filter((c) => c.point_de_vente?.site_id === siteId);
  });
  readonly selectedCaisseId = signal<number | null>(null);

  readonly soldes = signal<SoldePourboire[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  /** Ligne en cours de reversement. Non nulle = tiroir ouvert. */
  readonly cible = signal<SoldePourboire | null>(null);

  readonly peutReverser = computed(() => this.auth.hasPermission('versement.create'));

  /** Ce que l'établissement doit encore, tous serveurs confondus. */
  readonly totalDu = computed(() => this.soldes().reduce((total, ligne) => total + ligne.solde, 0));

  readonly reverserForm = this.fb.nonNullable.group({
    montant: [0, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const list = this.caisses();
      const courant = untracked(() => this.selectedCaisseId());
      if (courant !== null && list.some((c) => c.id === courant)) {
        return;
      }
      this.selectedCaisseId.set(list[0]?.id ?? null);
    });
  }

  ngOnInit(): void {
    this.caisseService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (caisses) => this.allCaisses.set(caisses),
        error: () => this.allCaisses.set([]),
      });

    this.charger();
  }

  onCaisseChange(valeur: string): void {
    this.selectedCaisseId.set(Number(valeur));
  }

  ouvrirReversement(ligne: SoldePourboire): void {
    this.cible.set(ligne);
    // Prérempli au solde : reverser en totalité est le geste courant, et le
    // caissier reste libre de payer une partie.
    this.reverserForm.reset({ montant: ligne.solde, notes: '' });
    this.formError.set(null);
  }

  fermerReversement(): void {
    if (this.saving()) {
      return;
    }
    this.cible.set(null);
    this.formError.set(null);
  }

  reverser(): void {
    const ligne = this.cible();
    const caisseId = this.selectedCaisseId();
    if (this.reverserForm.invalid || this.saving() || ligne === null || caisseId === null) {
      this.reverserForm.markAllAsTouched();

      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const raw = this.reverserForm.getRawValue();
    this.versementService
      .create(caisseId, {
        montant: raw.montant,
        destination: 'personnel',
        // Le solde se retire de CE serveur : c'est la ligne cliquée, pas un
        // nom saisi à la main qui ne se recouperait avec rien.
        beneficiaire_id: ligne.user_id,
        notes: raw.notes || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.cible.set(null);
          this.charger();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Reversement impossible.'));
        },
      });
  }

  private charger(): void {
    this.loading.set(true);
    this.pourboireService
      .soldes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (soldes) => {
          this.soldes.set(soldes);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
