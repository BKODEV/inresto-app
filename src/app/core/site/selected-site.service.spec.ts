import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SelectedSiteService } from './selected-site.service';
import { SiteService } from '../api/site/site.service';
import { Site } from '../api/site/site.model';

const STORAGE_KEY = 'inresto.selected_site_id';

function site(id: number, nom: string): Site {
  return { id, nom, code: `S${id}`, statut: 'actif' } as Site;
}

/**
 * Le périmètre conditionne toutes les données affichées. Ces tests verrouillent
 * la règle qui a motivé la refonte : **aucun site n'est choisi à la place de
 * l'utilisateur**, sauf quand il n'y a rien à choisir.
 */
describe('SelectedSiteService', () => {
  let perimetre: Site[];

  function creerService(): SelectedSiteService {
    TestBed.configureTestingModule({
      providers: [
        SelectedSiteService,
        { provide: SiteService, useValue: { perimetre: () => of(perimetre) } },
      ],
    });

    return TestBed.inject(SelectedSiteService);
  }

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    perimetre = [site(1, 'Plateau'), site(2, 'Riviera')];
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  it('réclame un choix quand plusieurs sites sont disponibles', () => {
    const service = creerService();
    service.refresh();

    expect(service.scope()).toBe('pending');
    expect(service.doitChoisir()).toBe(true);
    expect(service.selectedId()).toBe(null);
  });

  it('sélectionne d’office l’unique site du périmètre', () => {
    perimetre = [site(7, 'Zone 4')];
    const service = creerService();
    service.refresh();

    expect(service.scope()).toBe(7);
    expect(service.doitChoisir()).toBe(false);
    expect(service.consolidationPossible()).toBe(false);
  });

  it('connaît la portée mémorisée avant même le chargement du périmètre', () => {
    // Sans restauration synchrone, la portée reste « pending » pendant tout
    // l'aller-retour HTTP : les écrans affichés dans cette fenêtre s'alimentent
    // sans site (bon de commande sans en-tête, listes vides).
    localStorage.setItem(STORAGE_KEY, '2');

    const service = creerService(); // volontairement sans `refresh()`

    expect(service.selectedId()).toBe(2);
    expect(service.scopeInconnu()).toBe(false);
  });

  it('persiste le site choisi et le restaure', () => {
    const premier = creerService();
    premier.refresh();
    premier.selectSite(2);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('2');

    TestBed.resetTestingModule();
    const second = creerService();
    second.refresh();

    expect(second.scope()).toBe(2);
    expect(second.selectedSite()?.nom).toBe('Riviera');
  });

  it('persiste et restaure le mode consolidé', () => {
    const premier = creerService();
    premier.refresh();
    premier.selectTousLesSites();

    expect(premier.estConsolide()).toBe(true);
    expect(premier.siteIdParam()).toBe(undefined);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('all');

    TestBed.resetTestingModule();
    const second = creerService();
    second.refresh();

    expect(second.estConsolide()).toBe(true);
  });

  it('redemande un choix quand le site mémorisé a quitté le périmètre', () => {
    // Droits révoqués ou site désactivé : on ne bascule pas en silence sur un
    // autre site, l'utilisateur opérerait sur un stock qu'il n'a pas désigné.
    localStorage.setItem(STORAGE_KEY, '99');
    const service = creerService();
    service.refresh();

    expect(service.scope()).toBe('pending');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
  });

  it('incrémente l’epoch à chaque changement de portée, et pas autrement', () => {
    const service = creerService();
    service.refresh();
    const depart = service.epoch();

    service.selectSite(1);
    expect(service.epoch()).toBe(depart + 1);

    service.selectSite(1);
    expect(service.epoch()).toBe(depart + 1);

    service.selectTousLesSites();
    expect(service.epoch()).toBe(depart + 2);
  });

  it('expose site_id en mono-site et rien en consolidé', () => {
    const service = creerService();
    service.refresh();

    service.selectSite(1);
    expect(service.siteIdParam()).toBe(1);

    service.selectTousLesSites();
    expect(service.siteIdParam()).toBe(undefined);
  });

  it('ne propose aucun périmètre quand l’utilisateur n’a aucun site', () => {
    perimetre = [];
    const service = creerService();
    service.refresh();

    expect(service.scope()).toBe('pending');
    // Rien à choisir : la surcouche n'a pas lieu d'être, l'écran affiche son
    // propre état vide.
    expect(service.doitChoisir()).toBe(false);
  });
});
