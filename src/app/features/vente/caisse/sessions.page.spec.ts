import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SessionsPage } from './sessions.page';
import { EcartSens } from '../../../core/api/session-caisse/session-caisse.model';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * L'écran de fermeture est un écran de contrôle : ce qu'il affiche décide si un
 * responsable va chercher une erreur ou passe son chemin. Ces tests portent sur
 * ce que les chiffres prétendent dire.
 */
describe('SessionsPage — lecture de l’écart de caisse', () => {
  function creer() {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionCaisseService, useValue: { list: () => of([]) } },
        { provide: CaisseService, useValue: { list: () => of([]) } },
        {
          provide: SelectedSiteService,
          useValue: { selectedSite: () => null, estConsolide: () => false, selectedId: () => 1 },
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new SessionsPage());
  }

  it('nomme les quatre sens de l’écart', () => {
    const page = creer();

    expect(page.libelleEcart).toEqual({
      juste: 'Caisse juste',
      tolere: 'Écart toléré',
      excedent: 'Excédent',
      manquant: 'Manquant',
    });
  });

  it('couvre chaque sens renvoyé par l’API', () => {
    // Un sens sans libellé afficherait une cellule vide sur un écran d'argent.
    const page = creer();
    const sens: EcartSens[] = ['juste', 'tolere', 'excedent', 'manquant'];

    for (const s of sens) {
      expect(page.libelleEcart[s]).toBeTruthy();
    }
  });

  /**
   * Le montant attendu ne doit JAMAIS être proposé avant la saisie : le
   * caissier le recopierait au lieu de compter, et le rapprochement ne
   * vaudrait plus rien.
   */
  it('ouvre la fermeture sur un montant à zéro, sans souffler le théorique', () => {
    const page = creer();

    page.openFermer({
      id: 4,
      statut: 'ouverte',
      fonds_initial: '100.00',
      ouvert_le: '2026-08-21T08:00:00Z',
    } as never);

    expect(page.fermerForm.getRawValue().montant_reel).toBe(0);
  });
});
