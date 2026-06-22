import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MENU, MenuSection } from '../../core/navigation/menu.config';
import { IconComponent } from '../../shared/icon/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SelectedSiteService } from '../../core/site/selected-site.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.layout.html',
  styleUrl: './shell.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellLayout implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly selectedSiteService = inject(SelectedSiteService);

  readonly user = this.auth.user;

  /** Sélecteur de site global : pilote budget / inventaire / réception. */
  readonly sites = this.selectedSiteService.sites;
  readonly selectedSiteId = this.selectedSiteService.selectedId;
  readonly selectedSite = this.selectedSiteService.selectedSite;

  /** Sections de navigation visibles : filtrées par `enabled` + permission, sections vides masquées. */
  readonly sections = computed<MenuSection[]>(() => {
    this.user();
    return MENU.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.enabled !== false && this.auth.hasPermission(item.permission),
      ),
    })).filter((section) => section.items.length > 0);
  });

  /** Ouverture de la sidebar en mode mobile (off-canvas). Ignoré sur desktop (CSS). */
  readonly sidebarOpen = signal(false);

  private readonly now = signal<Date>(new Date());
  private clockId?: ReturnType<typeof setInterval>;

  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  private readonly timeFormatter = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  readonly dateLabel = computed(() => {
    const label = this.dateFormatter.format(this.now());
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  readonly timeLabel = computed(() => this.timeFormatter.format(this.now()));

  readonly userInitials = computed(() => {
    const u = this.user();
    if (!u) {
      return '?';
    }
    return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase();
  });

  ngOnInit(): void {
    this.clockId = setInterval(() => this.now.set(new Date()), 1000);
    // Charge les sites sélectionnables (post-connexion, le shell étant la zone authentifiée).
    this.selectedSiteService.refresh();
  }

  ngOnDestroy(): void {
    if (this.clockId) {
      clearInterval(this.clockId);
    }
  }

  onSiteChange(value: string): void {
    this.selectedSiteService.set(value ? Number(value) : null);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => {
        this.auth.clearSession();
        this.router.navigate(['/login']);
      },
    });
  }
}
