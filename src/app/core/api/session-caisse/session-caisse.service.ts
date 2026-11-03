import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  FermerSessionPayload,
  OuvrirSessionPayload,
  PositionCaisse,
  SessionCaisse,
} from './session-caisse.model';

interface SessionIndex {
  sessions: SessionCaisse[];
}

@Injectable({ providedIn: 'root' })
export class SessionCaisseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sessions-caisse`;

  list(caisseId?: number): Observable<SessionCaisse[]> {
    let params = new HttpParams();
    if (caisseId) {
      params = params.set('caisse_id', caisseId);
    }
    return this.http
      .get<ApiResponse<SessionIndex>>(this.base, { params })
      .pipe(map((r) => r.data.sessions));
  }

  get(id: number): Observable<SessionCaisse> {
    return this.http.get<ApiResponse<SessionCaisse>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  /**
   * Ce que la caisse devrait contenir en cours de service.
   *
   * 403 attendu et normal dans deux cas : sans la permission dédiée, et pour le
   * porteur d'une session encore ouverte — l'appelant doit afficher le message
   * de l'API plutôt que de traiter ça comme une panne.
   */
  position(id: number): Observable<PositionCaisse> {
    return this.http
      .get<ApiResponse<PositionCaisse>>(`${this.base}/${id}/position`)
      .pipe(map((r) => r.data));
  }

  ouvrir(payload: OuvrirSessionPayload): Observable<SessionCaisse> {
    return this.http.post<ApiResponse<SessionCaisse>>(this.base, payload).pipe(map((r) => r.data));
  }

  fermer(id: number, payload: FermerSessionPayload): Observable<SessionCaisse> {
    return this.http
      .post<ApiResponse<SessionCaisse>>(`${this.base}/${id}/fermer`, payload)
      .pipe(map((r) => r.data));
  }
}
