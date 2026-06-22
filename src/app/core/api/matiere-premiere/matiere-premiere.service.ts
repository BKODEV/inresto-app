import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination, Statut } from '../api.types';
import {
  CreateMatierePremierePayload,
  MatierePremiere,
  UpdateMatierePremierePayload,
} from './matiere-premiere.model';

export interface MatierePremiereFilters {
  libelle?: string;
  categorie_id?: number;
  statut?: Statut;
  per_page?: number;
}

interface MatierePremiereIndex {
  matieres_premieres: MatierePremiere[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class MatierePremiereService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matieres-premieres`;

  list(filters: MatierePremiereFilters = {}): Observable<MatierePremiere[]> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 100);
    if (filters.libelle) {
      params = params.set('libelle', filters.libelle);
    }
    if (filters.categorie_id) {
      params = params.set('categorie_id', filters.categorie_id);
    }
    if (filters.statut) {
      params = params.set('statut', filters.statut);
    }
    return this.http
      .get<ApiResponse<MatierePremiereIndex>>(this.base, { params })
      .pipe(map((r) => r.data.matieres_premieres));
  }

  get(id: number): Observable<MatierePremiere> {
    return this.http
      .get<ApiResponse<MatierePremiere>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateMatierePremierePayload): Observable<MatierePremiere> {
    return this.http
      .post<ApiResponse<MatierePremiere>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateMatierePremierePayload): Observable<MatierePremiere> {
    return this.http
      .put<ApiResponse<MatierePremiere>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
