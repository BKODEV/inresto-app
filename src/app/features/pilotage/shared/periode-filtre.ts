import { ChangeDetectionStrategy, Component, effect, output, signal } from '@angular/core';

import { PeriodeType, ReportingFilter } from '../../../core/api/reporting/reporting.model';

/**
 * Filtre temporel réutilisable par toutes les pages de pilotage. Émet un
 * `ReportingFilter` (sans périmètre site, ajouté par la page) à chaque
 * changement valide — la plage n'émet qu'avec ses deux bornes renseignées.
 */
@Component({
  selector: 'app-periode-filtre',
  standalone: true,
  templateUrl: './periode-filtre.html',
  styleUrl: './periode-filtre.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodeFiltre {
  readonly filterChange = output<ReportingFilter>();

  readonly periode = signal<PeriodeType>('mois');
  readonly date = signal<string>(PeriodeFiltre.aujourdhui());
  readonly dateDebut = signal<string>('');
  readonly dateFin = signal<string>('');

  readonly periodes: { value: PeriodeType; label: string }[] = [
    { value: 'jour', label: 'Jour' },
    { value: 'semaine', label: 'Semaine' },
    { value: 'mois', label: 'Mois' },
    { value: 'plage', label: 'Plage' },
  ];

  constructor() {
    effect(() => {
      const filter = this.buildFilter();
      if (filter) {
        this.filterChange.emit(filter);
      }
    });
  }

  setPeriode(value: string): void {
    this.periode.set(value as PeriodeType);
  }

  setDate(value: string): void {
    this.date.set(value);
  }

  setDateDebut(value: string): void {
    this.dateDebut.set(value);
  }

  setDateFin(value: string): void {
    this.dateFin.set(value);
  }

  /** Retourne `null` si la plage est incomplète (rien à émettre). */
  private buildFilter(): ReportingFilter | null {
    const periode = this.periode();
    if (periode === 'plage') {
      const debut = this.dateDebut();
      const fin = this.dateFin();
      if (!debut || !fin || debut > fin) {
        return null;
      }
      return { periode, date_debut: debut, date_fin: fin };
    }
    return { periode, date: this.date() };
  }

  private static aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
