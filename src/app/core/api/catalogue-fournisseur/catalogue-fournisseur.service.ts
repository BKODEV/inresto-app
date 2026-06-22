import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import {
  CatalogueFournisseur,
  CreateCatalogueFournisseurPayload,
  SyncCatalogueLine,
  UpdateCatalogueFournisseurPayload,
} from './catalogue-fournisseur.model';

export interface CatalogueFournisseurFilters {
  fournisseur_id?: number;
  matiere_premiere_id?: number;
  per_page?: number;
}

interface CatalogueFournisseurIndex {
  catalogue: CatalogueFournisseur[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class CatalogueFournisseurService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalogue-fournisseur`;

  list(filters: CatalogueFournisseurFilters = {}): Observable<CatalogueFournisseur[]> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 100);
    if (filters.fournisseur_id) {
      params = params.set('fournisseur_id', filters.fournisseur_id);
    }
    if (filters.matiere_premiere_id) {
      params = params.set('matiere_premiere_id', filters.matiere_premiere_id);
    }
    return this.http
      .get<ApiResponse<CatalogueFournisseurIndex>>(this.base, { params })
      .pipe(map((r) => r.data.catalogue));
  }

  get(id: number): Observable<CatalogueFournisseur> {
    return this.http
      .get<ApiResponse<CatalogueFournisseur>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCatalogueFournisseurPayload): Observable<CatalogueFournisseur> {
    return this.http
      .post<ApiResponse<CatalogueFournisseur>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateCatalogueFournisseurPayload): Observable<CatalogueFournisseur> {
    return this.http
      .put<ApiResponse<CatalogueFournisseur>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Remplace tout le catalogue d'un fournisseur par l'ensemble fourni
   * (suppression des lignes précédentes + insertion des nouvelles, côté serveur).
   */
  sync(fournisseurId: number, lignes: SyncCatalogueLine[]): Observable<CatalogueFournisseur[]> {
    return this.http
      .put<
        ApiResponse<CatalogueFournisseur[]>
      >(`${environment.apiUrl}/fournisseurs/${fournisseurId}/catalogue`, { lignes })
      .pipe(map((r) => r.data));
  }
}
