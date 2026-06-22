import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { CreateSitePayload, Site, UpdateSitePayload } from './site.model';

interface SiteIndex {
  sites: Site[];
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sites`;

  /** Périmètre métier de l'utilisateur connecté (sélecteur d'opérations, principal en tête). */
  perimetre(): Observable<Site[]> {
    return this.http
      .get<ApiResponse<SiteIndex>>(`${this.base}/perimetre`)
      .pipe(map((r) => r.data.sites));
  }

  /** Tous les sites (gestion, référentiel des Paramètres). */
  list(): Observable<Site[]> {
    return this.http.get<ApiResponse<SiteIndex>>(this.base).pipe(map((r) => r.data.sites));
  }

  get(id: number): Observable<Site> {
    return this.http.get<ApiResponse<Site>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateSitePayload): Observable<Site> {
    return this.http.post<ApiResponse<Site>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateSitePayload): Observable<Site> {
    return this.http.put<ApiResponse<Site>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
