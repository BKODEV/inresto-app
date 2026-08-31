import { ReportingFilter } from '../../../core/api/reporting/reporting.model';

export interface PlageDates {
  date_debut: string;
  date_fin: string;
}

/**
 * Traduit le filtre de `PeriodeFiltre` en bornes de dates.
 *
 * Les rapports laissent l'API résoudre `periode` + `date` ; les relectures de
 * contrôle (remises, annulations) n'exposent, elles, que `date_debut` et
 * `date_fin`. Résoudre ici permet aux deux familles d'écrans d'offrir le même
 * filtre — quatre choix, dont « Plage » — sans toucher aux deux API.
 *
 * La semaine commence le LUNDI, comme côté serveur : un dimanche appartient à
 * la semaine qui s'achève, et non à celle qui s'ouvre.
 */
export function plageDeReporting(filtre: ReportingFilter): PlageDates {
  if (filtre.periode === 'plage') {
    // Le composant n'émet une plage qu'avec ses deux bornes ; le repli couvre
    // un appel direct, hors de la barre de filtres.
    const debut = filtre.date_debut ?? filtre.date_fin ?? aujourdhui();

    return { date_debut: debut, date_fin: filtre.date_fin ?? debut };
  }

  const reference = versDate(filtre.date ?? aujourdhui());

  switch (filtre.periode) {
    case 'jour':
      return { date_debut: versTexte(reference), date_fin: versTexte(reference) };

    case 'semaine': {
      // `getDay()` compte à partir du dimanche : le décalage de 6 ramène le
      // lundi à 0 et laisse le dimanche en fin de semaine, à 6.
      const lundi = decaler(reference, -((reference.getDay() + 6) % 7));

      return { date_debut: versTexte(lundi), date_fin: versTexte(decaler(lundi, 6)) };
    }

    default: {
      const annee = reference.getFullYear();
      const mois = reference.getMonth();
      // Le jour 0 du mois suivant EST le dernier du mois courant : la longueur
      // du mois — et les années bissextiles — sont ainsi laissées au calendrier.
      return {
        date_debut: versTexte(new Date(annee, mois, 1)),
        date_fin: versTexte(new Date(annee, mois + 1, 0)),
      };
    }
  }
}

/**
 * Les dates sont construites et lues en heure LOCALE, jamais via `toISOString`
 * qui bascule en UTC : sur un poste à l'est de Greenwich, le 1er du mois y
 * repart au 31 précédent.
 */
function versDate(texte: string): Date {
  const [annee, mois, jour] = texte.split('-').map(Number);

  return new Date(annee, mois - 1, jour);
}

function versTexte(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${mois}-${jour}`;
}

function decaler(date: Date, jours: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + jours);
}

function aujourdhui(): string {
  return versTexte(new Date());
}
