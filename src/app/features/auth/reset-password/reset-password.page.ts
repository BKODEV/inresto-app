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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private token = '';
  private email = '';

  readonly tokenValide = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly success = signal(false);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.token = params.get('token') ?? '';
    this.email = params.get('email') ?? '';
    this.tokenValide.set(this.token !== '' && this.email !== '');
  }

  submit(): void {
    if (this.submitting() || !this.tokenValide()) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const { password, password_confirmation } = this.form.getRawValue();
    if (password !== password_confirmation) {
      this.errorMessage.set('Les deux mots de passe ne correspondent pas.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth
      .resetPassword({ email: this.email, token: this.token, password, password_confirmation })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
          setTimeout(() => this.router.navigate(['/login']), 2500);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(apiErrorMessage(err, 'Lien invalide ou expiré.'));
        },
      });
  }
}
