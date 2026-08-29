import { MENU } from './menu.config';
import { AuthService } from '../auth/auth.service';

/**
 * La première entrée de menu que cet utilisateur peut réellement ouvrir.
 *
 * La racine et la sortie de connexion renvoyaient toutes deux en dur sur
 * `/dashboard`, écran gouverné côté API par `reporting.dashboard` : qui ne
 * détient pas cette permission atterrissait à chaque connexion sur une page
 * qu'il ne peut pas charger. On le pose là où il a quelque chose à faire, dans
 * l'ordre du menu — qui est déjà l'ordre d'importance métier.
 *
 * Les écrans servis hors du shell — KDS mural, tablette du pass — passent en
 * SECOND : ce sont des appareils, pas des destinations. Un serveur détient
 * `commande_client.view` pour prendre ses commandes ; l'ouvrir sur l'afficheur
 * de la cuisine le laisserait devant un écran sans barre latérale, dont il ne
 * saurait pas ressortir.
 *
 * Mais s'ils sont les SEULS ouverts, ils redeviennent la bonne destination :
 * c'est le cas d'un compte d'appareil — « Écran cuisine — Restaurant », dont le
 * rôle ne porte que de quoi lire la file et annoncer au pass. Le repli sur
 * `/dashboard` l'aurait déposé sur un écran qu'il n'a pas le droit d'ouvrir, à
 * chaque démarrage de la tablette murale.
 *
 * Repli sur `/dashboard` si vraiment rien n'est ouvert : mieux vaut le refus
 * explicite de cet écran qu'une redirection en boucle.
 */
export function premiereRouteAutorisee(auth: AuthService): string {
  const ouvertes = MENU.flatMap((section) => section.items).filter(
    (item) => item.enabled !== false && auth.hasAnyPermission(item.permission),
  );

  // Un écran de navigation d'abord ; à défaut l'appareil, s'il est tout ce que
  // ce compte peut ouvrir.
  return (
    ouvertes.find((item) => item.horsShell !== true)?.route ?? ouvertes[0]?.route ?? '/dashboard'
  );
}
