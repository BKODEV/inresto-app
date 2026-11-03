import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { interval, startWith } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';

/**
 * Minutage de l'intro, en millisecondes. Le tracé, un temps d'arrêt pour que
 * l'œil se pose, puis l'effacement — qui recouvre l'arrivée de la carte plutôt
 * que de la précéder, sans quoi l'écran resterait vide entre les deux.
 */
const TRACE_MS = 550;
const PAUSE_MS = 200;
const SORTIE_MS = 300;

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.pret]': 'pret()',
    '[class.page]': "phase() !== 'intro'",
  },
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  /**
   * `intro` : seul le monogramme est à l'écran. `sortie` : il s'efface pendant
   * que la carte monte — les deux coexistent le temps de la transition.
   * `page` : l'intro est démontée.
   */
  readonly phase = signal<'intro' | 'sortie' | 'page'>('intro');

  /** Pose le départ du tracé. Voir `lancerIntro` pour le pourquoi du délai. */
  readonly pret = signal(false);

  private readonly minuteurs: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    // `afterNextRender` ne s'exécute pas côté serveur : le rendu SSR sort donc
    // la page telle quelle, sans intro ni classe à poser.
    afterNextRender(() => this.lancerIntro());
    this.destroyRef.onDestroy(() => this.minuteurs.forEach(clearTimeout));
  }

  private lancerIntro(): void {
    // Mouvement réduit : aucune intro. Retenir la page trois quarts de seconde
    // devant un monogramme immobile n'apporterait rien à personne.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.phase.set('page');
      return;
    }

    // `requestAnimationFrame` et non un `setTimeout` : il suit le rythme du
    // rendu, pas l'horloge. Tant que le navigateur ne produit pas d'image — fil
    // principal occupé à démarrer Angular — il n'est pas rappelé, et le tracé
    // ne part donc pas dans le vide.
    //
    // C'est exactement ce qui rendait la première version invisible : mesuré au
    // protocole DevTools, l'animation s'achevait à 568 ms pour un premier rendu
    // à 712 ms. Elle se jouait entièrement derrière un écran encore blanc.
    requestAnimationFrame(() => {
      this.pret.set(true);
      this.minuteurs.push(
        setTimeout(() => this.phase.set('sortie'), TRACE_MS + PAUSE_MS),
        setTimeout(() => this.phase.set('page'), TRACE_MS + PAUSE_MS + SORTIE_MS),
      );
    });
  }

  readonly showPassword = signal(false);
  readonly clockLabel = signal('— · —');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    identifiant: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [true],
  });

  ngOnInit(): void {
    interval(1000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clockLabel.set(this.buildClockLabel()));
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { identifiant, password } = this.form.getRawValue();

    this.auth
      .login({ identifiant, password, device_name: this.deviceName() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.extractError(err));
        },
      });
  }

  private extractError(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    }
    return apiErrorMessage(err, 'Une erreur est survenue. Veuillez réessayer.');
  }

  private deviceName(): string {
    if (typeof navigator === 'undefined') {
      return 'inresto-app';
    }
    return navigator.userAgent || 'inresto-app';
  }

  private buildClockLabel(): string {
    const tz = 'Africa/Abidjan';
    const now = new Date();
    const date = new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(now);
    const time = new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
    return `${date.charAt(0).toUpperCase()}${date.slice(1)}  ·  ${time} GMT`;
  }
}
