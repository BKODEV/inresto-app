import { CommonModule } from '@angular/common';
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
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { interval, startWith } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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
