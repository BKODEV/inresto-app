import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CategorieMatierePremiere,
  CreateCategorieMatierePremiere,
  UpdateCategorieMatierePremiere,
} from './categorie-matiere-premiere.model';

@Injectable({ providedIn: 'root' })
export class CategorieMatierePremièreService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/categories-matiere-premiere`;

  list(): Observable<CategorieMatierePremiere[]> {
    return this.http
      .get<ApiResponse<CategorieMatierePremiere[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<CategorieMatierePremiere> {
    return this.http
      .get<ApiResponse<CategorieMatierePremiere>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCategorieMatierePremiere): Observable<CategorieMatierePremiere> {
    return this.http
      .post<ApiResponse<CategorieMatierePremiere>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateCategorieMatierePremiere): Observable<CategorieMatierePremiere> {
    return this.http
      .put<ApiResponse<CategorieMatierePremiere>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
