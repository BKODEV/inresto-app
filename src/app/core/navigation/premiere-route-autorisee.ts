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
 * Repli sur `/dashboard` si rien n'est ouvert : mieux vaut le refus explicite
 * de cet écran qu'une redirection en boucle.
 */
export function premiereRouteAutorisee(auth: AuthService): string {
  for (const section of MENU) {
    for (const item of section.items) {
      if (item.enabled !== false && auth.hasAnyPermission(item.permission)) {
        return item.route;
      }
    }
  }

  return '/dashboard';
}
