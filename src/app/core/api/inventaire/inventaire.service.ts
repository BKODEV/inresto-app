import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import {
  CreateInventairePayload,
  Inventaire,
  LigneInventaire,
  LigneInventairePayload,
  RapportInventaire,
} from './inventaire.model';

export interface InventairePage {
  inventaires: Inventaire[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class InventaireService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventaires`;

  list(siteId?: number): Observable<InventairePage> {
    let params = new HttpParams().set('per_page', 50);
    if (siteId) {
      params = params.set('site_id', siteId);
    }
    return this.http
      .get<ApiResponse<InventairePage>>(this.base, { params })
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<Inventaire> {
    return this.http.get<ApiResponse<Inventaire>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateInventairePayload): Observable<Inventaire> {
    return this.http.post<ApiResponse<Inventaire>>(this.base, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addLigne(id: number, payload: LigneInventairePayload): Observable<LigneInventaire> {
    return this.http
      .post<ApiResponse<LigneInventaire>>(`${this.base}/${id}/lignes`, payload)
      .pipe(map((r) => r.data));
  }

  deleteLigne(id: number, ligneId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/lignes/${ligneId}`);
  }

  cloturer(id: number): Observable<Inventaire> {
    return this.http
      .post<ApiResponse<Inventaire>>(`${this.base}/${id}/cloturer`, {})
      .pipe(map((r) => r.data));
  }

  rapport(id: number): Observable<RapportInventaire> {
    return this.http
      .get<ApiResponse<RapportInventaire>>(`${this.base}/${id}/rapport`)
      .pipe(map((r) => r.data));
  }
}
