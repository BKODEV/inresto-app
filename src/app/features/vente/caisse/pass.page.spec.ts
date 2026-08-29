import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PassPage } from './pass.page';
import { ServicePass } from '../../../core/api/commande-client/commande-client.model';
import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { signal } from '@angular/core';

/**
 * Le pass est le seul écran d'où le stock se décharge : « Servi » déstocke, et
 * l'opération est irréversible. Ces tests verrouillent ce qui part exactement.
 */
describe('PassPage — enlèvement en salle', () => {
  let servirAppels: { id: number; ligneIds: number[] }[];

  function service(commandeId: number, ligneIds: number[]): ServicePass {
    return {
      commande_id: commandeId,
      table: null,
      prete_le: new Date().toISOString(),
      lignes: ligneIds.map((id) => ({
        id,
        commande_client_id: commandeId,
        produit_id: 1,
        fiche_technique_id: null,
        quantite: 1,
        prix_unitaire: '10.00',
        commentaire: null,
        statut: 'actif',
        envoyee_le: new Date().toISOString(),
        prete_le: new Date().toISOString(),
        servie_le: null,
        retirable_sans_motif: false,
      })) as ServicePass['lignes'],
    };
  }

  function configurer(services: ServicePass[], permissions: string[] = ['commande_client.update']) {
    servirAppels = [];

    TestBed.configureTestingModule({
      providers: [
        {
          provide: CommandeClientService,
          useValue: {
            pass: () => of(services),
            servir: (id: number, ligneIds: number[]) => {
              servirAppels.push({ id, ligneIds });
              return of({});
            },
          },
        },
        { provide: PointDeVenteService, useValue: { list: () => of([]) } },
        {
          provide: AuthService,
          useValue: { hasPermission: (p?: string) => !p || permissions.includes(p) },
        },
        {
          provide: SelectedSiteService,
          useValue: {
            selectedSite: signal(null),
            sites: signal([]),
            selectedId: signal(null),
            refresh: () => undefined,
          },
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new PassPage());
  }

  /**
   * Le geste vise les lignes de la carte affichée, et elles seules. Un appel
   * sans identifiants servirait TOUTE la production en attente de la note — y
   * compris un tour annoncé après l'affichage, qui n'est pas sous les yeux du
   * runner et n'a donc pas été porté.
   */
  it('ne sert que les lignes de la note affichée', () => {
    const page = configurer([service(7, [11, 12])]);

    page.servir(service(7, [11, 12]));

    expect(servirAppels).toEqual([{ id: 7, ligneIds: [11, 12] }]);
  });

  it('retire la note de la file une fois emportée', () => {
    const page = configurer([service(7, [11]), service(9, [21])]);
    page.services.set([service(7, [11]), service(9, [21])]);

    page.servir(service(7, [11]));

    expect(page.services().map((s) => s.commande_id)).toEqual([9]);
  });

  /**
   * Le garde-fou du déstockage partiel. Le runner qui ne porte que les entrées
   * d'une note dont les plats attendent encore sous la lampe ne doit décharger
   * QUE ce qu'il a emporté — servir la note entière déstockerait des plats
   * toujours en cuisine, et la dérive n'apparaîtrait qu'à l'inventaire.
   */
  it('n’emporte que la ligne touchée', () => {
    const note = service(7, [11, 12, 13]);
    const page = configurer([note]);
    page.services.set([note]);

    page.servirLigne(note, note.lignes[1]);

    expect(servirAppels).toEqual([{ id: 7, ligneIds: [12] }]);
  });

  it('garde la note au pass tant qu’il y reste des plats', () => {
    const note = service(7, [11, 12]);
    const page = configurer([note]);
    page.services.set([note]);

    page.servirLigne(note, note.lignes[0]);

    // La note demeure, allégée du seul plat parti.
    expect(page.services().map((s) => s.lignes.map((l) => l.id))).toEqual([[12]]);
  });

  it('retire la note quand son dernier plat part', () => {
    const note = service(7, [11]);
    const page = configurer([note]);
    page.services.set([note]);

    page.servirLigne(note, note.lignes[0]);

    expect(page.services()).toEqual([]);
  });

  /**
   * Servir déstocke : c'est `update`, la permission des changements d'état de
   * note. Un cuisinier, qui ne porte que `marquer_pret`, ne doit pas emporter.
   */
  it('ferme le geste à qui ne porte pas la permission de service', () => {
    const page = configurer([service(7, [11])], ['commande_client.marquer_pret']);

    expect(page.peutServir()).toBe(false);
  });
});
