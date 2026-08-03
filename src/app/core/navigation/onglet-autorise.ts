import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Ramène l'utilisateur sur le premier onglet qu'il est autorisé à voir lorsque
 * l'URL en désigne un autre.
 *
 * Une section à onglets n'est ouverte qu'à partir d'**une** permission, alors
 * que chaque onglet est gardé séparément (« Stock & inventaire » s'ouvre avec
 * `stock.view` OU `inventaire.view`). La redirection par défaut de la route,
 * elle, est figée : sans ce garde-fou, un utilisateur peut atterrir sur un
 * onglet absent de sa barre, dont l'API refusera les données.
 *
 * À appeler depuis le constructeur d'un layout (contexte d'injection requis).
 *
 * @param routesAutorisees Segments des onglets visibles, dans l'ordre d'affichage.
 */
export function redirigerVersOngletAutorise(routesAutorisees: string[]): void {
  const router = inject(Router);
  const route = inject(ActivatedRoute);

  if (routesAutorisees.length === 0) {
    return;
  }

  // On lit l'onglet dans le snapshot de la route enfant, et surtout PAS dans
  // `router.url` : au moment où le layout est construit, l'activation est en
  // cours et l'URL courante est encore la précédente — le garde-fou renverrait
  // alors systématiquement sur le premier onglet.
  const ongletDemande = route.snapshot.firstChild?.routeConfig?.path;

  if (ongletDemande !== undefined && !routesAutorisees.includes(ongletDemande)) {
    // `replaceUrl` : l'onglet interdit n'a pas à polluer l'historique, sinon le
    // retour arrière y ramène en boucle.
    void router.navigate([routesAutorisees[0]], { relativeTo: route, replaceUrl: true });
  }
}
