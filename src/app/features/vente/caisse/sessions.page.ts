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
import { EcartSens, SessionCaisse } from '../../../core/api/session-caisse/session-caisse.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { ModeDePaiementService } from '../../../core/api/mode-de-paiement/mode-de-paiement.service';
import { ModeDePaiement } from '../../../core/api/mode-de-paiement/mode-de-paiement.model';
import { modesProposables } from '../../../core/api/mode-de-paiement/mode-de-paiement.util';
import { MontantPipe, MontantSignePipe } from '../../../shared/format/nombre.pipes';

type DrawerMode = 'ouvrir' | 'fermer';

@Component({
  selector: 'app-sessions-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, SiteRequisComponent, MontantPipe, MontantSignePipe],
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
  private readonly pdfService = inject(PdfService);
  private readonly modeService = inject(ModeDePaiementService);

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
  readonly pdfBusy = signal(false);

  readonly sessionOuverte = computed(
    () => this.sessions().find((s) => s.statut === 'ouverte') ?? null,
  );

  readonly ouvrirForm = this.fb.nonNullable.group({
    fonds_initial: [0, [Validators.min(0)]],
  });
  readonly fermerForm = this.fb.nonNullable.group({
    notes: [''],
  });

  /** Modes de paiement actifs : un contenant à rapprocher par mode. */
  readonly modes = signal<ModeDePaiement[]>([]);

  /**
   * Ce que le caissier déclare, contenant par contenant. Une simple table
   * plutôt qu'un formulaire réactif : les contrôles sont indexés par des
   * identifiants de base qui changent d'un établissement à l'autre, et un
   * `FormRecord` n'apporterait ici qu'une couche de plus.
   *
   * Absent de la table = non rapproché, ce qui est licite : un virement arrive
   * à la banque quand il arrive.
   */
  readonly constats = signal<Record<number, number | null>>({});

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

  /**
   * Ce que l'écart raconte, en toutes lettres. Le badge affichait un rouge
   * unique dès que l'écart n'était pas nul : un excédent et un manquant s'y
   * confondaient, alors qu'ils appellent des vérifications opposées.
   */
  readonly libelleEcart: Record<EcartSens, string> = {
    // Personne n'a compté : on ne qualifie rien. Afficher « juste » laisserait
    // croire à une vérification qui n'a pas eu lieu.
    non_rapproche: 'Non rapproché',
    juste: 'Caisse juste',
    tolere: 'Écart toléré',
    excedent: 'Excédent',
    manquant: 'Manquant',
  };

  ngOnInit(): void {
    this.modeService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modes) => this.modes.set(modesProposables(modes)));

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
    this.fermerForm.reset({ notes: '' });
    // Toutes les cases vides : le formulaire ne souffle AUCUN montant attendu,
    // ni pour le tiroir ni pour le terminal. Le montrer inviterait à le
    // recopier au lieu de compter, et le rapprochement ne vaudrait plus rien.
    this.constats.set({});
    this.formError.set(null);
    this.drawerMode.set('fermer');
  }

  onConstat(modeId: number, valeur: string): void {
    const nombre = valeur.trim() === '' ? null : Number(valeur);
    this.constats.update((actuels) => ({
      ...actuels,
      [modeId]: nombre === null || Number.isNaN(nombre) ? null : nombre,
    }));
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

  /**
   * Rapport de fermeture (ticket Z). Imprimable à nouveau depuis la liste : un
   * ticket se perd, et le rapprochement doit rester consultable.
   */
  imprimerRapport(session: SessionCaisse): void {
    if (this.pdfBusy()) {
      return;
    }
    this.pdfBusy.set(true);
    this.pdfService
      .rapportFermeture(session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.pdfBusy.set(false);
          ouvrirPdfDansOnglet(blob, `rapport-fermeture-${session.id}.pdf`);
        },
        error: (err: HttpErrorResponse) => {
          this.pdfBusy.set(false);
          this.formError.set(apiErrorMessage(err, 'Impression impossible.'));
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
    const constats = this.constats();

    this.sessionService
      .fermer(session.id, {
        notes: this.fermerForm.getRawValue().notes,
        // Seuls les contenants réellement déclarés sont transmis. Envoyer un
        // zéro pour les autres ferait passer une case laissée vide pour un
        // contrôle qui a eu lieu.
        rapprochements: this.modes()
          .filter((mode) => constats[mode.id] !== null && constats[mode.id] !== undefined)
          .map((mode) => ({
            mode_de_paiement_id: mode.id,
            montant_constate: constats[mode.id],
          })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.sessions.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
          this.saving.set(false);
          this.drawerMode.set(null);
          // Le rapport sort dans la foulée, comme le reçu après un règlement :
          // c'est le document qu'on classe dans le tiroir en le refermant.
          this.imprimerRapport(updated);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Fermeture impossible.'));
        },
      });
  }
}
