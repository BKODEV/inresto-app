import { DestroyRef, inject } from '@angular/core';

/**
 * Relance périodiquement une action tant que le composant vit.
 *
 * Les écrans de service (KDS accroché au mur, plan de salle sur tablette) sont
 * consultés sans être touchés : sans rafraîchissement, un écran de cuisine
 * n'affiche jamais la commande suivante et personne n'ira cliquer un bouton
 * « actualiser » les mains occupées.
 *
 * Le tic est suspendu quand l'onglet passe en arrière-plan — inutile
 * d'interroger l'API pour une page que personne ne regarde — et reprend par un
 * appel immédiat au retour, pour ne pas afficher une donnée périmée le temps
 * d'un intervalle.
 *
 * À appeler depuis un constructeur (contexte d'injection requis).
 *
 * @param intervalleMs Délai entre deux appels.
 * @param action       Le rafraîchissement à déclencher.
 * @param enPause      Rend la main quand l'écran ne doit pas se recharger
 *                     (tiroir ouvert, formulaire en cours de saisie…).
 */
export function rafraichissementAuto(
  intervalleMs: number,
  action: () => void,
  enPause: () => boolean = () => false,
): void {
  const destroyRef = inject(DestroyRef);

  if (typeof window === 'undefined') {
    return; // rendu serveur : rien à rafraîchir
  }

  const masque = (): boolean => typeof document !== 'undefined' && document.hidden;

  const tic = (): void => {
    if (!masque() && !enPause()) {
      action();
    }
  };

  const identifiant = setInterval(tic, intervalleMs);

  const auRetour = (): void => {
    if (!masque()) {
      tic();
    }
  };
  document.addEventListener('visibilitychange', auRetour);

  destroyRef.onDestroy(() => {
    clearInterval(identifiant);
    document.removeEventListener('visibilitychange', auRetour);
  });
}
