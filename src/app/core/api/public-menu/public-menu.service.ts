import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiBaseUrl } from '../api-base.util';
import { ApiResponse } from '../api.types';
import { MenuPublic } from './public-menu.model';

/**
 * Menu consulté par un client depuis le QR de sa table.
 *
 * Seul service de l'app qui appelle un endpoint non authentifié : le jeton de
 * l'URL fait office de clé d'accès. L'intercepteur n'ajoute aucun token ici
 * (aucune session), ce qui est exactement l'effet recherché.
 *
 * Seul service aussi à être appelé pendant le rendu SERVEUR (la page menu est
 * la seule route rendue côté serveur), d'où la base résolue en absolu.
 */
@Injectable({ providedIn: 'root' })
export class PublicMenuService {
  private readonly http = inject(HttpClient);
  private readonly base = `${apiBaseUrl()}/public/menu`;

  get(token: string): Observable<MenuPublic> {
    return this.http
      .get<ApiResponse<MenuPublic>>(`${this.base}/${encodeURIComponent(token)}`)
      .pipe(map((r) => r.data));
  }
}
