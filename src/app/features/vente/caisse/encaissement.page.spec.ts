import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { EncaissementPage } from './encaissement.page';
import { CommandeClient } from '../../../core/api/commande-client/commande-client.model';
import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import { ModeDePaiementService } from '../../../core/api/mode-de-paiement/mode-de-paiement.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PdfService } from '../../../core/api/pdf/pdf.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Le règlement au comptoir enchaîne deux appels — enregistrer le paiement,
 * puis clôturer la note — et la décision de clôturer dépend de ce que l'API
 * renvoie, pas de ce que le caissier a saisi. Ces tests verrouillent cet
 * enchaînement : c'est là que l'argent entre dans le système.
 */
describe('EncaissementPage — tiroir de règlement', () => {
  function note(surcharge: Partial<CommandeClient> = {}): CommandeClient {
    return {
      id: 142,
      table_numero: 'T07',
      statut: 'servie',
      date_heure: '2026-08-20T18:00:00Z',
      montant_total: '5000.00',
      montant_du: '5000.00',
      montant_paye: '0.00',
      reste_a_payer: '5000.00',
      serveur: 'Kouassi A.',
      ...surcharge,
    } as CommandeClient;
  }

  function creer(options: { peutEncaisser?: boolean; api?: Partial<CommandeClientService> } = {}) {
    const api = {
      list: vi.fn().mockReturnValue(of([])),
      get: vi.fn(),
      ajouterPaiement: vi.fn().mockReturnValue(of({})),
      encaisser: vi.fn(),
      ...options.api,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: CommandeClientService, useValue: api },
        { provide: ModeDePaiementService, useValue: { list: () => of([]) } },
        {
          provide: PdfService,
          useValue: { additionClient: () => of(new Blob()), recuClient: () => of(new Blob()) },
        },
        { provide: PointDeVenteService, useValue: { list: () => of([]) } },
        {
          provide: AuthService,
          useValue: { hasPermission: () => options.peutEncaisser !== false },
        },
        {
          provide: SelectedSiteService,
          useValue: {
            selectedSite: () => null,
            estConsolide: () => false,
            selectedId: () => 1,
          },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new EncaissementPage());
    // Les modes viennent d'un stub vide : on injecte celui que le caissier
    // choisirait, sinon le formulaire reste invalide et `regler()` rend la main.
    page.modes.set([
      { id: 5, libelle: 'Espèces', compte_en_caisse: true, ordre: 1, statut: 'actif' },
    ] as never);

    return { page, api };
  }

  it('solde la note en un geste : paiement puis clôture, et la note quitte la file', () => {
    const soldee = note({ montant_paye: '5000.00', reste_a_payer: '0.00' });
    const { page, api } = creer({
      api: {
        get: vi.fn().mockReturnValue(of(soldee)),
        encaisser: vi.fn().mockReturnValue(of({ ...soldee, statut: 'encaissee' })),
      } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.regler();

    expect(api.ajouterPaiement).toHaveBeenCalledWith(142, {
      mode_de_paiement_id: 5,
      montant: 5000,
      pourboire: null,
      montant_recu: null,
    });
    expect(api.encaisser).toHaveBeenCalledWith(142);
    expect(page.notes()).toEqual([]);
    // Le tiroir reste ouvert sur la remise du reçu, il ne se referme pas.
    expect(page.etape()).toBe('reglee');
  });

  /**
   * `montant` alimente le fond de caisse théorique de la session. Y inscrire le
   * billet tendu compterait comme en tiroir de l'argent déjà rendu au client,
   * et ferait apparaître un manquant à la fermeture, égal à la monnaie.
   */
  it('enregistre le montant encaissé, pas le billet tendu', () => {
    const soldee = note({ montant_paye: '5000.00', reste_a_payer: '0.00' });
    const { page, api } = creer({
      api: {
        get: vi.fn().mockReturnValue(of(soldee)),
        encaisser: vi.fn().mockReturnValue(of({ ...soldee, statut: 'encaissee' })),
      } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant_recu: 10000 });

    expect(page.monnaieSaisie()).toBe(5000);

    page.regler();

    expect(api.ajouterPaiement).toHaveBeenCalledWith(142, {
      mode_de_paiement_id: 5,
      montant: 5000,
      pourboire: null,
      montant_recu: 10000,
    });
    expect(page.monnaieARendre()).toBe(5000);
  });

  it('ne transmet pas de billet tendu quand le compte est juste', () => {
    // Une carte ou l'appoint exact : rien à mémoriser, et surtout rien à rendre.
    const soldee = note({ montant_paye: '5000.00', reste_a_payer: '0.00' });
    const { page, api } = creer({
      api: {
        get: vi.fn().mockReturnValue(of(soldee)),
        encaisser: vi.fn().mockReturnValue(of({ ...soldee, statut: 'encaissee' })),
      } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant_recu: 5000 });
    page.regler();

    expect(api.ajouterPaiement).toHaveBeenCalledWith(142, {
      mode_de_paiement_id: 5,
      montant: 5000,
      pourboire: null,
      montant_recu: null,
    });
    expect(page.monnaieARendre()).toBe(0);
  });

  it('refuse un billet tendu inférieur au montant encaissé', () => {
    // Les deux champs inversés : on ne rend pas plus que ce qu'on a reçu.
    const { page, api } = creer();
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant_recu: 2000 });

    expect(page.recuInsuffisant()).toBe(true);

    page.regler();

    expect(api.ajouterPaiement).not.toHaveBeenCalled();
    expect(page.formError()).toContain('inférieur');
  });

  it('ne clôture pas sur un paiement partiel et rouvre le tiroir sur le reste', () => {
    // Espèces puis carte, ou acompte : le caissier enchaîne sans rien rouvrir.
    const partielle = note({ montant_paye: '3000.00', reste_a_payer: '2000.00' });
    const { page, api } = creer({
      api: { get: vi.fn().mockReturnValue(of(partielle)) } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant: 3000 });
    page.regler();

    expect(api.encaisser).not.toHaveBeenCalled();
    expect(page.notes()).toHaveLength(1);
    expect(page.notes()[0].reste_a_payer).toBe('2000.00');
    expect(page.cible()?.reste_a_payer).toBe('2000.00');
    expect(page.reglementForm.getRawValue().montant).toBe(2000);
    expect(page.info()).toContain('Reste');
  });

  it('décide sur le reste renvoyé par l’API, pas sur le montant saisi', () => {
    // Une remise appliquée depuis la fiche entre l'ouverture du tiroir et la
    // validation solde la note avec moins que le reste affiché.
    const soldee = note({ montant_du: '3000.00', montant_paye: '3000.00', reste_a_payer: '0.00' });
    const { page, api } = creer({
      api: {
        get: vi.fn().mockReturnValue(of(soldee)),
        encaisser: vi.fn().mockReturnValue(of({ ...soldee, statut: 'encaissee' })),
      } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant: 3000 });
    page.regler();

    expect(api.encaisser).toHaveBeenCalledWith(142);
    expect(page.notes()).toEqual([]);
  });

  it('enregistre quand même l’argent sans la permission de clôturer', () => {
    // `paiement.create` et `commande_client.encaisser` sont deux permissions :
    // bloquer la saisie ferait sortir l'argent du système.
    const soldee = note({ montant_paye: '5000.00', reste_a_payer: '0.00' });
    const { page, api } = creer({
      peutEncaisser: false,
      api: { get: vi.fn().mockReturnValue(of(soldee)) } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.regler();

    expect(api.ajouterPaiement).toHaveBeenCalled();
    expect(api.encaisser).not.toHaveBeenCalled();
    expect(page.notes()).toHaveLength(1);
    expect(page.cible()).toBeNull();
    expect(page.etape()).toBe('saisie');
  });

  it('laisse le tiroir ouvert avec le message de l’API quand le paiement échoue', () => {
    const { page } = creer({
      api: {
        ajouterPaiement: vi.fn().mockReturnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 422,
                error: { message: 'Session caisse fermée.' },
              }),
          ),
        ),
      } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.regler();

    expect(page.cible()).not.toBeNull();
    expect(page.formError()).toBe('Session caisse fermée.');
    expect(page.busy()).toBe(false);
  });

  /**
   * Le mode présélectionné décide dans quelle colonne l'argent est compté à la
   * fermeture. Il valait `modes()[0]` sur une liste que l'API renvoyait sans
   * tri : un mode hors tiroir placé en tête devenait le défaut sans que
   * personne ne l'ait décidé.
   */
  it('présélectionne le mode qui alimente le tiroir, pas le premier affiché', () => {
    const { page } = creer();
    page.modes.set([
      { id: 9, libelle: 'Virement', compte_en_caisse: false, ordre: 1, statut: 'actif' },
      { id: 5, libelle: 'Espèces', compte_en_caisse: true, ordre: 2, statut: 'actif' },
    ] as never);
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);

    expect(page.reglementForm.getRawValue().mode_de_paiement_id).toBe(5);
  });

  it('change de mode au clic sur son bouton', () => {
    const { page } = creer();
    page.modes.set([
      { id: 5, libelle: 'Espèces', compte_en_caisse: true, ordre: 1, statut: 'actif' },
      { id: 9, libelle: 'Virement', compte_en_caisse: false, ordre: 2, statut: 'actif' },
    ] as never);
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.choisirMode(9);

    expect(page.reglementForm.getRawValue().mode_de_paiement_id).toBe(9);
  });

  /**
   * « Gardez la monnaie » : le geste le plus courant du comptoir. Le pourboire
   * reste en tiroir — il compte donc dans le fond théorique — sans jamais
   * devenir de la recette.
   */
  it('bascule la monnaie en pourboire d’un seul geste', () => {
    const soldee = note({ montant_paye: '5000.00', reste_a_payer: '0.00' });
    const { page, api } = creer({
      api: {
        get: vi.fn().mockReturnValue(of(soldee)),
        encaisser: vi.fn().mockReturnValue(of({ ...soldee, statut: 'encaissee' })),
      } as Partial<CommandeClientService>,
    });
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant_recu: 6000 });

    expect(page.monnaieSaisie()).toBe(1000);

    page.garderLaMonnaie();

    // Plus rien à rendre : le client a laissé la différence.
    expect(page.monnaieSaisie()).toBe(0);
    expect(page.reglementForm.getRawValue().pourboire).toBe(1000);

    page.regler();

    expect(api.ajouterPaiement).toHaveBeenCalledWith(142, {
      mode_de_paiement_id: 5,
      montant: 5000,
      pourboire: 1000,
      // Rien à rendre, donc pas de billet à mémoriser.
      montant_recu: null,
    });
  });

  it('retranche le pourboire de la monnaie à rendre', () => {
    // Le client pose 10 000 sur 5 000 et laisse 1 000 : on lui rend 4 000.
    const { page } = creer();
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant_recu: 10000, pourboire: 1000 });

    expect(page.monnaieSaisie()).toBe(4000);
  });

  it('refuse un billet qui ne couvre pas la vente et le pourboire', () => {
    const { page, api } = creer();
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    page.reglementForm.patchValue({ montant_recu: 5500, pourboire: 1000 });

    expect(page.recuInsuffisant()).toBe(true);

    page.regler();

    expect(api.ajouterPaiement).not.toHaveBeenCalled();
  });

  it('annonce si le geste solde la note, avant de valider', () => {
    const { page } = creer();
    page.notes.set([note()]);

    page.ouvrirReglement(page.notes()[0]);
    expect(page.soldeLaNote()).toBe(true);

    page.reglementForm.patchValue({ montant: 2000 });
    expect(page.soldeLaNote()).toBe(false);
    expect(page.resteApres()).toBe(3000);

    page.reglementForm.patchValue({ montant: 6000 });
    expect(page.resteApres()).toBe(-1000);
  });
});
