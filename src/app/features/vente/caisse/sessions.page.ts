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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { Caisse } from '../../../core/api/caisse/caisse.model';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { SessionCaisse } from '../../../core/api/session-caisse/session-caisse.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';

type DrawerMode = 'ouvrir' | 'fermer';

@Component({
  selector: 'app-sessions-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, SiteRequisComponent],
  templateUrl: './sessions.page.html',
  styleUrl: './caisse.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsPage implements OnInit {
  private readonly caisseService = inject(CaisseService);
  private readonly sessionService = inject(SessionCaisseService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Toutes les caisses chargées, puis restreintes au site global (via leur PDV).
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
  readonly sessions = signal<SessionCaisse[]>([]);
  readonly loading = signal(true);
  readonly loadingSessions = signal(false);

  readonly drawerMode = signal<DrawerMode | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly closingSession = signal<SessionCaisse | null>(null);

  readonly sessionOuverte = computed(
    () => this.sessions().find((s) => s.statut === 'ouverte') ?? null,
  );

  readonly ouvrirForm = this.fb.nonNullable.group({
    fonds_initial: [0, [Validators.min(0)]],
  });
  readonly fermerForm = this.fb.nonNullable.group({
    montant_reel: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  constructor() {
    // Aligne la caisse sélectionnée sur le site global et recharge ses sessions.
    effect(() => {
      const list = this.caisses();
      const current = untracked(() => this.selectedCaisseId());
      if (current !== null && list.some((c) => c.id === current)) {
        return;
      }
      const next = list[0]?.id ?? null;
      this.selectedCaisseId.set(next);
      if (next !== null) {
        this.loadSessions(next);
      } else {
        this.sessions.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.caisseService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (caisses) => {
          this.allCaisses.set(caisses);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selectCaisse(id: number): void {
    this.selectedCaisseId.set(id);
    this.loadSessions(id);
  }

  private loadSessions(id: number): void {
    this.loadingSessions.set(true);
    this.sessionService
      .list(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.loadingSessions.set(false);
        },
        error: () => this.loadingSessions.set(false),
      });
  }

  onCaisseChange(value: string): void {
    this.selectCaisse(Number(value));
  }

  openOuvrir(): void {
    this.ouvrirForm.reset({ fonds_initial: 0 });
    this.formError.set(null);
    this.drawerMode.set('ouvrir');
  }

  openFermer(session: SessionCaisse): void {
    this.closingSession.set(session);
    this.fermerForm.reset({ montant_reel: 0, notes: '' });
    this.formError.set(null);
    this.drawerMode.set('fermer');
  }

  closeDrawer(): void {
    this.drawerMode.set(null);
  }

  ouvrir(): void {
    const caisseId = this.selectedCaisseId();
    if (this.ouvrirForm.invalid || this.saving() || caisseId === null) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.sessionService
      .ouvrir({ caisse_id: caisseId, fonds_initial: this.ouvrirForm.getRawValue().fonds_initial })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.sessions.update((list) => [session, ...list]);
          this.saving.set(false);
          this.drawerMode.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Ouverture impossible.'));
        },
      });
  }

  fermer(): void {
    const session = this.closingSession();
    if (this.fermerForm.invalid || this.saving() || !session) {
      this.fermerForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.sessionService
      .fermer(session.id, this.fermerForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.sessions.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
          this.saving.set(false);
          this.drawerMode.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Fermeture impossible.'));
        },
      });
  }
}
