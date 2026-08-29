import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MesPourboiresPage } from './mes-pourboires.page';
import { PourboireService } from '../../../core/api/pourboire/pourboire.service';

/**
 * L'écran ne lit que soi-même : l'API ne prend aucun identifiant, et il n'y a
 * donc rien à filtrer côté client. Ces tests portent sur ce qu'il affiche.
 */
describe('MesPourboiresPage — son propre cumul', () => {
  function creer(reponse?: unknown) {
    const monSolde = vi.fn().mockReturnValue(
      of(
        reponse ?? {
          solde: {
            user_id: 'moi',
            serveur: 'Kouassi A.',
            encaisse: 1500,
            reverse: 600,
            solde: 900,
          },
          reversements: [{ montant: 600, date_heure: '2026-08-20T22:00:00Z', notes: null }],
        },
      ),
    );

    TestBed.configureTestingModule({
      providers: [{ provide: PourboireService, useValue: { monSolde } }],
    });

    const page = TestBed.runInInjectionContext(() => new MesPourboiresPage());
    page.ngOnInit();

    return { page, monSolde };
  }

  it('expose les trois chiffres du cumul', () => {
    const { page } = creer();

    expect(page.donnees()?.solde.encaisse).toBe(1500);
    expect(page.donnees()?.solde.reverse).toBe(600);
    expect(page.donnees()?.solde.solde).toBe(900);
    expect(page.loading()).toBe(false);
  });

  it('liste les reversements reçus', () => {
    const { page } = creer();

    expect(page.donnees()?.reversements).toHaveLength(1);
    expect(page.donnees()?.reversements[0].montant).toBe(600);
  });

  it('n’envoie aucun identifiant : on ne lit que soi-même', () => {
    const { monSolde } = creer();

    expect(monSolde).toHaveBeenCalledWith();
  });

  it('rend la main si l’appel échoue', () => {
    // Sans permission l'API répond 403 : l'écran ne doit pas rester à charger.
    const monSolde = vi.fn().mockReturnValue(throwError(() => new Error('403')));
    TestBed.configureTestingModule({
      providers: [{ provide: PourboireService, useValue: { monSolde } }],
    });

    const page = TestBed.runInInjectionContext(() => new MesPourboiresPage());
    page.ngOnInit();

    expect(page.loading()).toBe(false);
    expect(page.donnees()).toBeNull();
  });
});
