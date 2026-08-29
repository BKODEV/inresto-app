import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import {
  FermerSessionCuisinePayload,
  OuvrirSessionCuisinePayload,
  ProductionSession,
  SessionCuisine,
  SessionCuisineFiltres,
} from './session-cuisine.model';

@Injectable({ providedIn: 'root' })
export class SessionCuisineService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sessions-cuisine`;

  list(
    filtres: SessionCuisineFiltres = {},
  ): Observable<{ sessions: SessionCuisine[]; pagination: Pagination }> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres) as [string, unknown][]) {
      if (valeur !== undefined && valeur !== null && valeur !== '') {
        params = params.set(cle, String(valeur));
      }
    }

    return this.http
      .get<ApiResponse<{ sessions: SessionCuisine[]; pagination: Pagination }>>(this.base, {
        params,
      })
      .pipe(map((r) => r.data));
  }

  ouvrir(payload: OuvrirSessionCuisinePayload): Observable<SessionCuisine> {
    return this.http.post<ApiResponse<SessionCuisine>>(this.base, payload).pipe(map((r) => r.data));
  }

  fermer(id: number, payload: FermerSessionCuisinePayload = {}): Observable<SessionCuisine> {
    return this.http
      .post<ApiResponse<SessionCuisine>>(`${this.base}/${id}/fermer`, payload)
      .pipe(map((r) => r.data));
  }

  /** Ce que la brigade a produit — la raison d'être du module. */
  production(id: number): Observable<ProductionSession> {
    return this.http
      .get<ApiResponse<ProductionSession>>(`${this.base}/${id}/production`)
      .pipe(map((r) => r.data));
  }
}
