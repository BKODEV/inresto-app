import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { PourboireService } from '../../../core/api/pourboire/pourboire.service';
import { MonSoldePourboire } from '../../../core/api/pourboire/pourboire.model';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

/**
 * Ce qu'un serveur voit de ses propres pourboires.
 *
 * L'écran n'existe que si la direction a attribué `pourboire.suivre_les_siens`,
 * volontairement absente de tous les rôles par défaut : que l'équipe suive ses
 * cumuls est une décision d'organisation, pas un réglage technique.
 *
 * On ne lit que soi-même — l'API ne prend aucun identifiant en paramètre.
 */
@Component({
  selector: 'app-mes-pourboires-page',
  standalone: true,
  imports: [DatePipe, MontantPipe],
  templateUrl: './mes-pourboires.page.html',
  styleUrl: './mes-pourboires.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MesPourboiresPage implements OnInit {
  private readonly service = inject(PourboireService);
  private readonly destroyRef = inject(DestroyRef);

  readonly donnees = signal<MonSoldePourboire | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.service
      .monSolde()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (donnees) => {
          this.donnees.set(donnees);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
