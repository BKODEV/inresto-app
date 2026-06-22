import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import { CreateReceptionPayload, LigneReceptionPayload, Reception } from './reception.model';

export interface ReceptionFilters {
  commande_fournisseur_id?: number;
  site_id?: number;
  per_page?: number;
  page?: number;
}

export interface ReceptionPage {
  receptions: Reception[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class ReceptionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/receptions`;

  list(filters: ReceptionFilters = {}): Observable<ReceptionPage> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 50);
    if (filters.commande_fournisseur_id) {
      params = params.set('commande_fournisseur_id', filters.commande_fournisseur_id);
    }
    if (filters.site_id) {
      params = params.set('site_id', filters.site_id);
    }
    if (filters.page) {
      params = params.set('page', filters.page);
    }
    return this.http
      .get<ApiResponse<ReceptionPage>>(this.base, { params })
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<Reception> {
    return this.http.get<ApiResponse<Reception>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateReceptionPayload): Observable<Reception> {
    return this.http.post<ApiResponse<Reception>>(this.base, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Confirme la réception : déclenche entrée stock + dépenses + transition commande. */
  confirmer(id: number, lignes: LigneReceptionPayload[]): Observable<Reception> {
    return this.http
      .post<ApiResponse<Reception>>(`${this.base}/${id}/confirmer`, { lignes })
      .pipe(map((r) => r.data));
  }
}
