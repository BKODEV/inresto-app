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

import { AuthService } from '../../../core/auth/auth.service';
import { UserService } from '../../../core/api/user/user.service';
import { RoleService } from '../../../core/api/role/role.service';
import { SiteService } from '../../../core/api/site/site.service';
import { CreateUserPayload, UpdateUserPayload, User } from '../../../core/api/user/user.model';
import { Role } from '../../../core/api/role/role.model';
import { Site } from '../../../core/api/site/site.model';
import { Statut } from '../../../core/api/api.types';
import { apiErrorMessage } from '../../../core/api/api-error.util';

type PasswordMode = 'saisir' | 'email';
type ResetMode = 'definir' | 'lien';

@Component({
  selector: 'app-utilisateurs-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './utilisateurs.page.html',
  styleUrl: './utilisateurs.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UtilisateursPage implements OnInit {
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly siteService = inject(SiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<User[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly loading = signal(true);

  // Filtres
  readonly filtreSite = signal<number | null>(null);
  readonly filtreRole = signal<string | null>(null);
  readonly filtreStatut = signal<Statut | null>(null);
  readonly recherche = signal('');

  // Drawer création / édition
  readonly drawerOpen = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly passwordMode = signal<PasswordMode>('saisir');
  readonly selectedRoles = signal<string[]>([]);
  readonly selectedSites = signal<number[]>([]);

  // Drawer réinitialisation de mot de passe
  readonly resetDrawerOpen = signal(false);
  readonly resetUser = signal<User | null>(null);
  readonly resetMode = signal<ResetMode>('definir');
  readonly resetBusy = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetMessage = signal<string | null>(null);

  readonly actionBusyId = signal<string | null>(null);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  /** Niveau de sécurité de l'utilisateur connecté (Infinity pour un super-admin). */
  readonly monNiveau = computed(() => {
    if (this.isSuperAdmin()) {
      return Number.POSITIVE_INFINITY;
    }
    const mesRoles = this.auth.user()?.roles ?? [];
    const niveaux = this.roles()
      .filter((r) => mesRoles.includes(r.name))
      .map((r) => r.niveau);
    return niveaux.length ? Math.max(...niveaux) : 0;
  });

  /** Rôles assignables : uniquement ceux de niveau strictement inférieur au mien. */
  readonly rolesAssignables = computed(() =>
    this.roles().filter((r) => this.isSuperAdmin() || r.niveau < this.monNiveau()),
  );

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(255)]],
    prenom: ['', [Validators.required, Validators.maxLength(255)]],
    identifiant: ['', [Validators.required, Validators.maxLength(255)]],
    email: [''],
    telephone: [''],
    pin_code: [''],
    statut: ['actif' as Statut],
    password: [''],
  });

  readonly resetForm = this.fb.nonNullable.group({
    new_password: [''],
  });

  ngOnInit(): void {
    this.roleService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((roles) => this.roles.set(roles));

    this.siteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sites) => this.sites.set(sites));

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.userService
      .list({
        site_id: this.filtreSite(),
        role: this.filtreRole(),
        statut: this.filtreStatut(),
        q: this.recherche().trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onFiltreSite(value: string): void {
    this.filtreSite.set(value ? Number(value) : null);
    this.load();
  }

  onFiltreRole(value: string): void {
    this.filtreRole.set(value || null);
    this.load();
  }

  onFiltreStatut(value: string): void {
    this.filtreStatut.set((value as Statut) || null);
    this.load();
  }

  onRecherche(value: string): void {
    this.recherche.set(value);
    this.load();
  }

  /** Hiérarchie : peut-on agir sur cet utilisateur ? */
  peutGerer(user: User): boolean {
    return this.isSuperAdmin() || user.niveau_max < this.monNiveau();
  }

  rolesLabel(user: User): string {
    return user.roles.map((r) => r.name).join(', ') || '—';
  }

  sitesLabel(user: User): string {
    return user.sites.map((s) => s.code).join(', ') || '—';
  }

  // --- Drawer création / édition -------------------------------------------

  openCreate(): void {
    this.editingUser.set(null);
    this.form.reset({
      nom: '',
      prenom: '',
      identifiant: '',
      email: '',
      telephone: '',
      pin_code: '',
      statut: 'actif',
      password: '',
    });
    this.passwordMode.set('saisir');
    this.selectedRoles.set([]);
    this.selectedSites.set([]);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(user: User): void {
    this.editingUser.set(user);
    this.form.reset({
      nom: user.nom,
      prenom: user.prenom,
      identifiant: user.identifiant,
      email: user.email ?? '',
      telephone: user.telephone ?? '',
      pin_code: '',
      statut: user.statut,
      password: '',
    });
    this.selectedRoles.set(user.roles.map((r) => r.name));
    this.selectedSites.set(user.sites.map((s) => s.id));
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  setPasswordMode(mode: PasswordMode): void {
    this.passwordMode.set(mode);
    this.formError.set(null);
  }

  toggleRole(name: string): void {
    this.selectedRoles.update((list) =>
      list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
    );
  }

  toggleSite(id: number): void {
    this.selectedSites.update((list) =>
      list.includes(id) ? list.filter((s) => s !== id) : [...list, id],
    );
  }

  save(): void {
    if (this.saving()) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editingUser();

    // Validation conditionnelle mot de passe / email à la création.
    if (!editing) {
      if (this.passwordMode() === 'saisir' && raw.password.length < 8) {
        this.formError.set('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      if (this.passwordMode() === 'email' && !raw.email.trim()) {
        this.formError.set('Un email est requis pour envoyer le mot de passe provisoire.');
        return;
      }
    }

    this.saving.set(true);
    this.formError.set(null);

    const base = {
      nom: raw.nom,
      prenom: raw.prenom,
      identifiant: raw.identifiant,
      email: raw.email.trim() || null,
      telephone: raw.telephone.trim() || null,
      pin_code: raw.pin_code.trim() || null,
      statut: raw.statut,
      roles: this.selectedRoles(),
      sites: this.selectedSites(),
    };

    if (editing) {
      const payload: UpdateUserPayload = base;
      this.userService
        .update(editing.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (saved) => this.onSaved(saved),
          error: (err: HttpErrorResponse) => this.onSaveError(err),
        });
    } else {
      const payload: CreateUserPayload = {
        ...base,
        password: this.passwordMode() === 'saisir' ? raw.password : null,
      };
      this.userService
        .create(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (saved) => this.onSaved(saved),
          error: (err: HttpErrorResponse) => this.onSaveError(err),
        });
    }
  }

  private onSaved(saved: User): void {
    this.users.update((list) => {
      const exists = list.some((u) => u.id === saved.id);
      return exists ? list.map((u) => (u.id === saved.id ? saved : u)) : [saved, ...list];
    });
    this.saving.set(false);
    this.drawerOpen.set(false);
  }

  private onSaveError(err: HttpErrorResponse): void {
    this.saving.set(false);
    this.formError.set(apiErrorMessage(err, 'Enregistrement impossible.'));
  }

  // --- Actions ligne --------------------------------------------------------

  toggleActivation(user: User): void {
    this.actionBusyId.set(user.id);
    const request$ =
      user.statut === 'actif'
        ? this.userService.desactiver(user.id)
        : this.userService.activer(user.id);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.users.update((list) => list.map((u) => (u.id === saved.id ? saved : u)));
        this.actionBusyId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.actionBusyId.set(null);
        alert(apiErrorMessage(err, 'Action impossible.'));
      },
    });
  }

  remove(user: User): void {
    if (!confirm(`Supprimer l'utilisateur « ${user.prenom} ${user.nom} » ?`)) {
      return;
    }
    this.actionBusyId.set(user.id);
    this.userService
      .delete(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
          this.actionBusyId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.actionBusyId.set(null);
          alert(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }

  // --- Drawer réinitialisation ---------------------------------------------

  openReset(user: User): void {
    this.resetUser.set(user);
    this.resetMode.set('definir');
    this.resetForm.reset({ new_password: '' });
    this.resetError.set(null);
    this.resetMessage.set(null);
    this.resetDrawerOpen.set(true);
  }

  closeReset(): void {
    this.resetDrawerOpen.set(false);
  }

  setResetMode(mode: ResetMode): void {
    this.resetMode.set(mode);
    this.resetError.set(null);
    this.resetMessage.set(null);
  }

  submitReset(): void {
    const user = this.resetUser();
    if (!user || this.resetBusy()) {
      return;
    }

    if (this.resetMode() === 'definir') {
      const pwd = this.resetForm.getRawValue().new_password;
      if (pwd.length < 8) {
        this.resetError.set('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      this.resetBusy.set(true);
      this.resetError.set(null);
      this.userService
        .resetPassword(user.id, pwd)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.resetBusy.set(false);
            this.resetMessage.set('Mot de passe réinitialisé.');
          },
          error: (err: HttpErrorResponse) => {
            this.resetBusy.set(false);
            this.resetError.set(apiErrorMessage(err, 'Réinitialisation impossible.'));
          },
        });
    } else {
      this.resetBusy.set(true);
      this.resetError.set(null);
      this.userService
        .sendResetLink(user.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.resetBusy.set(false);
            this.resetMessage.set('Lien de réinitialisation envoyé par email.');
          },
          error: (err: HttpErrorResponse) => {
            this.resetBusy.set(false);
            this.resetError.set(apiErrorMessage(err, 'Envoi impossible.'));
          },
        });
    }
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
