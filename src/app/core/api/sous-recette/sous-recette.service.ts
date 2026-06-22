import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { SousRecette, SousRecettePayload } from './sous-recette.model';

interface SousRecetteIndex {
  sous_recettes: SousRecette[];
}

@Injectable({ providedIn: 'root' })
export class SousRecetteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sous-recettes`;

  list(perPage = 100): Observable<SousRecette[]> {
    const params = new HttpParams().set('per_page', perPage);
    return this.http
      .get<ApiResponse<SousRecetteIndex>>(this.base, { params })
      .pipe(map((r) => r.data.sous_recettes));
  }

  get(id: number): Observable<SousRecette> {
    return this.http.get<ApiResponse<SousRecette>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: SousRecettePayload): Observable<SousRecette> {
    return this.http.post<ApiResponse<SousRecette>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: SousRecettePayload): Observable<SousRecette> {
    return this.http
      .put<ApiResponse<SousRecette>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
