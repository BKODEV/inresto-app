import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AnnulationsPage } from './annulations.page';
import { RemisesPage } from './remises.page';
import { AuditService } from '../../../core/api/audit/audit.service';
import { AnnulationAudit, RemiseAudit } from '../../../core/api/audit/audit.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

const PAGINATION = { total: 2, par_page: 50, page_courante: 1, derniere_page: 1 };

function providers(remises: RemiseAudit[], annulations: AnnulationAudit[]) {
  const remisesFn = vi.fn().mockReturnValue(of({ lignes: remises, pagination: PAGINATION }));
  const annulationsFn = vi
    .fn()
    .mockReturnValue(of({ lignes: annulations, pagination: PAGINATION }));

  return {
    remisesFn,
    annulationsFn,
    liste: [
      { provide: AuditService, useValue: { remises: remisesFn, annulations: annulationsFn } },
      provideRouter([]),
      {
        provide: SelectedSiteService,
        useValue: { epoch: () => 0, selectedId: () => 1 },
      },
    ],
  };
}

/**
 * `remise.view` et `annulation.view` existaient au catalogue, les policies
 * portaient `viewAny`, et rien ne les consommait. Ces écrans ferment la chaîne.
 */
describe('RemisesPage — relecture des remises', () => {
  function remise(surcharge: Partial<RemiseAudit> = {}): RemiseAudit {
    return {
      id: 1,
      commande_client_id: 142,
      user_id: 'uuid-kouassi',
      type: 'montant_fixe',
      valeur: '5000.00',
      motif: 'geste commercial',
      date_heure: '2026-08-20T19:00:00Z',
      auteur: 'Kouassi A.',
      table_numero: 'T07',
      ...surcharge,
    };
  }

  function creer(remises: RemiseAudit[] = [remise()]) {
    const { remisesFn, liste } = providers(remises, []);
    TestBed.configureTestingModule({ providers: liste });
    const page = TestBed.runInInjectionContext(() => new RemisesPage());
    page.ngOnInit();

    return { page, remisesFn };
  }

  it('ouvre sur le mois en cours plutôt que sur la journée', () => {
    // Une remise se contrôle sur une période, pas sur un service : la question
    // est « combien a-t-on remis ce mois-ci ».
    const { page } = creer();
    const now = new Date();
    const premier = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    expect(page.dateDebut()).toBe(premier);
  });

  /**
   * Le piège de cet écran : additionner un pourcentage à un montant. « 10 % »
   * et « 5 000 F » ne sont pas dans la même unité, et le pourcentage se
   * rapporte au total de SA note, absent de la table.
   */
  it('ne somme que les montants fixes', () => {
    const { page } = creer([
      remise({ id: 1, type: 'montant_fixe', valeur: '5000.00' }),
      remise({ id: 2, type: 'pourcentage', valeur: '10.00' }),
      remise({ id: 3, type: 'montant_fixe', valeur: '2000.00' }),
    ]);

    expect(page.totalMontantFixe()).toBe(7000);
    expect(page.nbPourcentage()).toBe(1);
  });

  it('rend un pourcentage et un montant dans leur unité', () => {
    const { page } = creer();

    expect(page.valeur(remise({ type: 'pourcentage', valeur: '10' }))).toContain('%');
    expect(page.valeur(remise({ type: 'montant_fixe', valeur: '5000' }))).not.toContain('%');
  });

  it('filtre sur le type, et revient à la première page', () => {
    const { page, remisesFn } = creer();
    page.allerPage(3);

    page.onType('pourcentage');

    expect(page.page()).toBe(1);
    expect(remisesFn).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'pourcentage', page: 1 }),
    );
  });
});

describe('AnnulationsPage — le devenir du stock', () => {
  function annulation(surcharge: Partial<AnnulationAudit> = {}): AnnulationAudit {
    return {
      id: 1,
      user_id: 'uuid-kouassi',
      annulable_type: 'lignes_commande_client',
      annulable_id: 7,
      sort: 'perte',
      motif: 'plat renvoyé',
      date_heure: '2026-08-20T19:00:00Z',
      auteur: 'Kouassi A.',
      commande_client_id: 142,
      ...surcharge,
    };
  }

  function creer(annulations: AnnulationAudit[] = [annulation()]) {
    const { annulationsFn, liste } = providers([], annulations);
    TestBed.configureTestingModule({ providers: liste });
    const page = TestBed.runInInjectionContext(() => new AnnulationsPage());
    page.ngOnInit();

    return { page, annulationsFn };
  }

  /**
   * Le chiffre que le responsable vient chercher : une matière déchargée puis
   * jetée ne revient jamais au stock, et se répète rarement par hasard.
   */
  it('compte les pertes de la page', () => {
    const { page } = creer([
      annulation({ id: 1, sort: 'perte' }),
      annulation({ id: 2, sort: 'remise_en_stock' }),
      annulation({ id: 3, sort: 'perte' }),
      annulation({ id: 4, sort: null }),
    ]);

    expect(page.nbPertes()).toBe(2);
  });

  it('filtre sur le devenir du stock', () => {
    const { page, annulationsFn } = creer();

    page.onSort('perte');

    expect(annulationsFn).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'perte' }));
  });

  it('filtre sur la nature de l’annulation', () => {
    const { page, annulationsFn } = creer();

    page.onNature('commandes_client');

    expect(annulationsFn).toHaveBeenLastCalledWith(
      expect.objectContaining({ annulable_type: 'commandes_client' }),
    );
  });

  it('retire un filtre quand on revient à « tous »', () => {
    const { page, annulationsFn } = creer();
    page.onSort('perte');

    page.onSort('');

    expect(annulationsFn).toHaveBeenLastCalledWith(expect.objectContaining({ sort: undefined }));
  });

  it('nomme les deux devenirs et les deux natures', () => {
    // Un libellé manquant s'affiche en badge vide sur un écran de contrôle.
    const { page } = creer();

    expect(page.sortLabel.perte).toBeTruthy();
    expect(page.sortLabel.remise_en_stock).toBeTruthy();
    expect(page.natureLabel.commandes_client).toBeTruthy();
    expect(page.natureLabel.lignes_commande_client).toBeTruthy();
  });
});
