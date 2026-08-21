import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { VentesPage } from './ventes.page';
import { CommandeClient } from '../../../core/api/commande-client/commande-client.model';
import {
  CommandeClientService,
  CommandeFiltres,
} from '../../../core/api/commande-client/commande-client.service';
import { SessionCaisse } from '../../../core/api/session-caisse/session-caisse.model';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { PdfService } from '../../../core/api/pdf/pdf.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Écran d'argent : un total affiché y engage. Ces tests portent surtout sur ce
 * que les chiffres prétendent être — le total d'une page n'est pas celui d'une
 * session, et le dire est la moitié du travail.
 */
describe('VentesPage — ventes d’une session de caisse', () => {
  function vente(surcharge: Partial<CommandeClient> = {}): CommandeClient {
    return {
      id: 142,
      table_numero: 'T07',
      statut: 'encaissee',
      date_heure: '2026-08-20T19:00:00Z',
      montant_total: '5000.00',
      montant_du: '5000.00',
      montant_paye: '5000.00',
      reste_a_payer: '0.00',
      serveur: 'Kouassi A.',
      paiements: [
        {
          id: 1,
          montant: '5000.00',
          mode_de_paiement: { id: 5, libelle: 'Espèces' },
        },
      ],
      ...surcharge,
    } as CommandeClient;
  }

  function session(surcharge: Partial<SessionCaisse> = {}): SessionCaisse {
    return {
      id: 9,
      statut: 'fermee',
      ouvert_le: '2026-08-19T10:00:00Z',
      ...surcharge,
    } as SessionCaisse;
  }

  function creer(
    options: { ventes?: CommandeClient[]; total?: number; sessions?: SessionCaisse[] } = {},
  ) {
    const ventes = options.ventes ?? [vente()];
    const listPagine = vi.fn().mockReturnValue(
      of({
        commandes: ventes,
        pagination: {
          total: options.total ?? ventes.length,
          par_page: 50,
          page_courante: 1,
          derniere_page: Math.max(1, Math.ceil((options.total ?? ventes.length) / 50)),
        },
      }),
    );
    const sessions = options.sessions ?? [session()];

    TestBed.configureTestingModule({
      providers: [
        { provide: CommandeClientService, useValue: { listPagine } },
        { provide: SessionCaisseService, useValue: { list: () => of(sessions) } },
        { provide: CaisseService, useValue: { list: () => of([]) } },
        { provide: PdfService, useValue: { recuClient: () => of(new Blob()) } },
        {
          provide: SelectedSiteService,
          useValue: { selectedSite: () => null, estConsolide: () => false, selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new VentesPage());

    return { page, listPagine };
  }

  it('ne demande que les notes encaissées de la session, paiements compris', () => {
    const { page, listPagine } = creer();

    page.onCaisseChange('3');

    const filtres = listPagine.mock.calls[0][0] as CommandeFiltres;
    expect(filtres.statut).toEqual(['encaissee']);
    expect(filtres.session_caisse_id).toBe(9);
    expect(filtres.avec_paiements).toBe(true);
  });

  it('ouvre sur la session en cours plutôt que sur la plus récemment ouverte', () => {
    // Une session ouverte hier et jamais fermée reste celle qu'on consulte.
    const { page } = creer({
      sessions: [
        session({ id: 9, statut: 'fermee', ouvert_le: '2026-08-20T10:00:00Z' }),
        session({ id: 4, statut: 'ouverte', ouvert_le: '2026-08-19T10:00:00Z' }),
      ],
    });

    page.onCaisseChange('3');

    expect(page.selectedSessionId()).toBe(4);
  });

  it('ventile par mode de paiement', () => {
    const { page } = creer({
      ventes: [
        vente({ id: 1, montant_du: '5000.00' }),
        vente({
          id: 2,
          montant_du: '3000.00',
          paiements: [{ id: 2, montant: '3000.00', mode_de_paiement: { id: 6, libelle: 'Carte' } }],
        } as Partial<CommandeClient>),
      ],
    });

    page.onCaisseChange('3');

    expect(page.ventilation()).toEqual([
      { libelle: 'Espèces', montant: 5000, notes: 1 },
      { libelle: 'Carte', montant: 3000, notes: 1 },
    ]);
  });

  it('agrège plusieurs paiements d’une même note sous leur mode', () => {
    // Espèces puis carte sur la même addition : deux lignes, pas une moyenne.
    const { page } = creer({
      ventes: [
        vente({
          montant_du: '8000.00',
          paiements: [
            { id: 1, montant: '5000.00', mode_de_paiement: { id: 5, libelle: 'Espèces' } },
            { id: 2, montant: '3000.00', mode_de_paiement: { id: 6, libelle: 'Carte' } },
          ],
        } as Partial<CommandeClient>),
      ],
    });

    page.onCaisseChange('3');

    expect(page.ventilation()).toEqual([
      { libelle: 'Espèces', montant: 5000, notes: 1 },
      { libelle: 'Carte', montant: 3000, notes: 1 },
    ]);
  });

  /**
   * Le total additionne les notes chargées, donc une page. Annoncer « total
   * encaissé » sur 50 notes d'une session qui en compte 120 serait un faux
   * chiffre — l'écran doit savoir qu'il ne montre qu'une part.
   */
  it('sait quand son total ne couvre pas toute la session', () => {
    const { page } = creer({ ventes: [vente()], total: 120 });

    page.onCaisseChange('3');

    expect(page.totalPage()).toBe(5000);
    expect(page.totalSession()).toBe(120);
    expect(page.pageUnique()).toBe(false);
  });

  it('assume son total quand la session tient sur une page', () => {
    const { page } = creer({ ventes: [vente()], total: 1 });

    page.onCaisseChange('3');

    expect(page.pageUnique()).toBe(true);
  });
});
