import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CommandesVentePage } from './commandes.page';
import { CommandeClient } from '../../../core/api/commande-client/commande-client.model';
import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { TableService } from '../../../core/api/table/table.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

const MOI = 'uuid-serveur-connecte';
const COLLEGUE = 'uuid-autre-serveur';

/**
 * Le plan de salle est l'écran du serveur. Ces tests portent sur les deux
 * signaux qu'il n'avait pas : à qui est la table, et depuis combien de temps
 * elle attend son addition.
 */
describe('CommandesVentePage — attente de règlement et mes tables', () => {
  function commande(surcharge: Partial<CommandeClient> = {}): CommandeClient {
    return {
      id: 1,
      table_id: 10,
      user_id: MOI,
      statut: 'servie',
      servie_le: new Date(Date.now() - (5 * 60 + 30) * 1000).toISOString(),
      reste_a_payer: '5000.00',
      ...surcharge,
    } as CommandeClient;
  }

  function creer(commandes: CommandeClient[] = [], tables = [{ id: 10, numero: 'T01' }]) {
    TestBed.configureTestingModule({
      providers: [
        { provide: CommandeClientService, useValue: { list: () => of(commandes) } },
        { provide: TableService, useValue: { list: () => of(tables) } },
        { provide: SessionCaisseService, useValue: { list: () => of([]) } },
        { provide: PointDeVenteService, useValue: { list: () => of([]) } },
        { provide: AuthService, useValue: { user: () => ({ id: MOI }) } },
        {
          provide: SelectedSiteService,
          useValue: { selectedSite: () => null, estConsolide: () => false, selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new CommandesVentePage());
    page.commandes.set(commandes);
    page.tables.set(tables as never);

    return page;
  }

  it('compte l’attente depuis le service, pas depuis l’ouverture de la note', () => {
    // Une table peut manger deux heures : c'est le passage à « servie » qui
    // ouvre l'attente du règlement.
    const page = creer();

    expect(page.attenteReglement(commande())).toBe('5 min');
  });

  it('n’affiche aucune attente tant que la note n’est pas servie', () => {
    const page = creer();

    expect(
      page.attenteReglement(commande({ statut: 'envoyee_en_cuisine', servie_le: null })),
    ).toBeNull();
  });

  it('bascule en heures au-delà de soixante minutes', () => {
    const page = creer();
    const servieLe = new Date(Date.now() - (75 * 60 + 30) * 1000).toISOString();

    expect(page.attenteReglement(commande({ servie_le: servieLe }))).toBe('1 h 15');
  });

  it('escalade visuellement quand la table traîne', () => {
    const page = creer();
    const depuis = (minutes: number) =>
      commande({ servie_le: new Date(Date.now() - (minutes * 60 + 30) * 1000).toISOString() });

    expect(page.classeAttente(depuis(5))).toBe('');
    expect(page.classeAttente(depuis(20))).toBe('attente--attention');
    expect(page.classeAttente(depuis(45))).toBe('attente--oubli');
  });

  it('ne garde que mes tables quand le filtre est actif', () => {
    const page = creer(
      [
        commande({ id: 1, table_id: 10, user_id: MOI }),
        commande({ id: 2, table_id: 11, user_id: COLLEGUE }),
      ],
      [
        { id: 10, numero: 'T01' },
        { id: 11, numero: 'T02' },
      ],
    );

    expect(page.plan()).toHaveLength(2);

    page.mesTablesSeulement.set(true);

    const restantes = page.plan();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].commande?.user_id).toBe(MOI);
  });

  /**
   * Le filtre porte sur les notes, pas sur les tables : une table libre n'a
   * pas de propriétaire, et la garder afficherait des places à prendre qui ne
   * sont à personne.
   */
  it('écarte les tables libres quand on ne veut voir que les siennes', () => {
    const page = creer(
      [commande({ id: 1, table_id: 10, user_id: MOI })],
      [
        { id: 10, numero: 'T01' },
        { id: 12, numero: 'T03' },
      ],
    );

    page.mesTablesSeulement.set(true);

    expect(page.plan().map((e) => e.table.numero)).toEqual(['T01']);
  });
});
