import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination, Statut } from '../api.types';
import {
  CreateFournisseurPayload,
  Fournisseur,
  UpdateFournisseurPayload,
} from './fournisseur.model';

export interface FournisseurFilters {
  nom?: string;
  statut?: Statut;
  per_page?: number;
}

interface FournisseurIndex {
  fournisseurs: Fournisseur[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class FournisseurService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fournisseurs`;

  list(filters: FournisseurFilters = {}): Observable<Fournisseur[]> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 100);
    if (filters.nom) {
      params = params.set('nom', filters.nom);
    }
    if (filters.statut) {
      params = params.set('statut', filters.statut);
    }
    return this.http
      .get<ApiResponse<FournisseurIndex>>(this.base, { params })
      .pipe(map((r) => r.data.fournisseurs));
  }

  get(id: number): Observable<Fournisseur> {
    return this.http.get<ApiResponse<Fournisseur>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateFournisseurPayload): Observable<Fournisseur> {
    return this.http.post<ApiResponse<Fournisseur>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateFournisseurPayload): Observable<Fournisseur> {
    return this.http
      .put<ApiResponse<Fournisseur>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
