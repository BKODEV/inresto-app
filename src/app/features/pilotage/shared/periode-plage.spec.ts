import { plageDeReporting } from './periode-plage';

/**
 * Les rapports laissent l'API résoudre la période ; les relectures de contrôle
 * n'acceptent que des bornes. Une erreur ici décale silencieusement la période
 * lue — le pire cas pour un écran de contrôle, qui semble répondre juste.
 */
describe('plageDeReporting', () => {
  it('borne un jour sur lui-même', () => {
    expect(plageDeReporting({ periode: 'jour', date: '2026-08-20' })).toEqual({
      date_debut: '2026-08-20',
      date_fin: '2026-08-20',
    });
  });

  it('ouvre la semaine au lundi', () => {
    // 2026-08-20 est un jeudi.
    expect(plageDeReporting({ periode: 'semaine', date: '2026-08-20' })).toEqual({
      date_debut: '2026-08-17',
      date_fin: '2026-08-23',
    });
  });

  it('rattache le dimanche à la semaine qui s’achève', () => {
    // Le piège de `getDay()`, qui compte à partir du dimanche : sans décalage,
    // ce 2026-08-23 ouvrirait une semaine au lieu de la fermer.
    expect(plageDeReporting({ periode: 'semaine', date: '2026-08-23' })).toEqual({
      date_debut: '2026-08-17',
      date_fin: '2026-08-23',
    });
  });

  it('couvre le mois entier, quelle que soit sa longueur', () => {
    expect(plageDeReporting({ periode: 'mois', date: '2026-08-20' })).toEqual({
      date_debut: '2026-08-01',
      date_fin: '2026-08-31',
    });
    expect(plageDeReporting({ periode: 'mois', date: '2026-02-10' })).toEqual({
      date_debut: '2026-02-01',
      date_fin: '2026-02-28',
    });
  });

  it('suit le calendrier sur une année bissextile', () => {
    expect(plageDeReporting({ periode: 'mois', date: '2028-02-10' }).date_fin).toBe('2028-02-29');
  });

  it('passe l’année sur un mois de décembre', () => {
    expect(plageDeReporting({ periode: 'mois', date: '2026-12-15' })).toEqual({
      date_debut: '2026-12-01',
      date_fin: '2026-12-31',
    });
  });

  it('reprend une plage telle quelle', () => {
    expect(
      plageDeReporting({ periode: 'plage', date_debut: '2026-01-05', date_fin: '2026-03-08' }),
    ).toEqual({ date_debut: '2026-01-05', date_fin: '2026-03-08' });
  });

  it('se replie sur aujourd’hui quand rien n’est précisé', () => {
    const now = new Date();
    const attendu = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    expect(plageDeReporting({}).date_debut).toBe(attendu);
  });
});
