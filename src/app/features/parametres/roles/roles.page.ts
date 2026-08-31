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
import { RoleService } from '../../../core/api/role/role.service';
import { PermissionService } from '../../../core/api/permission/permission.service';
import { CreateRolePayload, Role, UpdateRolePayload } from '../../../core/api/role/role.model';
import { PermissionModule } from '../../../core/api/permission/permission.model';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './roles.page.html',
  styleUrl: './roles.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly permissionService = inject(PermissionService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly roles = signal<Role[]>([]);
  readonly modules = signal<PermissionModule[]>([]);
  readonly loading = signal(true);

  readonly drawerOpen = signal(false);
  readonly editingRole = signal<Role | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedPermissions = signal<string[]>([]);
  readonly deletingId = signal<number | null>(null);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    niveau: [10, [Validators.required, Validators.min(0), Validators.max(99)]],
  });

  ngOnInit(): void {
    if (this.isSuperAdmin()) {
      this.permissionService
        .list()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((modules) => this.modules.set(modules));
    }
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.roleService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => {
          this.roles.set(roles);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openCreate(): void {
    this.editingRole.set(null);
    this.form.reset({ name: '', description: '', niveau: 10 });
    this.selectedPermissions.set([]);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(role: Role): void {
    this.editingRole.set(role);
    this.form.reset({
      name: role.name,
      description: role.description ?? '',
      niveau: role.niveau,
    });
    this.formError.set(null);
    this.drawerOpen.set(true);

    // Le détail porte les permissions ; on les charge pour pré-cocher la matrice.
    this.roleService
      .get(role.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((full) => this.selectedPermissions.set(full.permissions ?? []));
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  togglePermission(name: string): void {
    this.selectedPermissions.update((list) =>
      list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
    );
  }

  toggleModule(module: PermissionModule): void {
    const names = module.permissions.map((p) => p.name);
    const allSelected = this.isModuleAllSelected(module);
    this.selectedPermissions.update((list) =>
      allSelected ? list.filter((n) => !names.includes(n)) : [...new Set([...list, ...names])],
    );
  }

  isModuleAllSelected(module: PermissionModule): boolean {
    const selected = this.selectedPermissions();
    return module.permissions.every((p) => selected.includes(p.name));
  }

  isSelected(name: string): boolean {
    return this.selectedPermissions().includes(name);
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const raw = this.form.getRawValue();
    const editing = this.editingRole();

    if (editing) {
      const payload: UpdateRolePayload = {
        name: raw.name,
        description: raw.description.trim() || null,
        niveau: raw.niveau,
        permissions: this.selectedPermissions(),
      };
      this.roleService
        .update(editing.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (saved) => this.onSaved(saved),
          error: (err: HttpErrorResponse) => this.onError(err),
        });
    } else {
      const payload: CreateRolePayload = {
        name: raw.name,
        description: raw.description.trim() || null,
        niveau: raw.niveau,
        permissions: this.selectedPermissions(),
      };
      this.roleService
        .create(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (saved) => this.onSaved(saved),
          error: (err: HttpErrorResponse) => this.onError(err),
        });
    }
  }

  private onSaved(saved: Role): void {
    this.mergeRole(saved);
    this.saving.set(false);
    this.drawerOpen.set(false);
  }

  /** Met à jour la liste en conservant le compteur d'utilisateurs si connu. */
  private mergeRole(saved: Role): void {
    this.roles.update((list) => {
      const existing = list.find((r) => r.id === saved.id);
      const merged = existing
        ? { ...saved, users_count: existing.users_count }
        : { ...saved, users_count: 0 };
      return existing ? list.map((r) => (r.id === saved.id ? merged : r)) : [merged, ...list];
    });
  }

  private onError(err: HttpErrorResponse): void {
    this.saving.set(false);
    this.formError.set(apiErrorMessage(err, 'Enregistrement impossible.'));
  }

  async remove(role: Role): Promise<void> {
    if (role.is_system) {
      return;
    }
    if (!(await this.alertes.confirmerSuppression(role.name, { nature: 'le rôle' }))) {
      return;
    }
    this.deletingId.set(role.id);
    this.roleService
      .delete(role.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.roles.update((list) => list.filter((r) => r.id !== role.id));
          this.deletingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          this.alertes.erreur(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}
