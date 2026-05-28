import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CategorieProduit,
  CreateCategorieProduitPayload,
  UpdateCategorieProduitPayload,
} from './categorie-produit.model';

@Injectable({ providedIn: 'root' })
export class CategorieProduitService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/categories-produit`;

  list(): Observable<CategorieProduit[]> {
    return this.http
      .get<ApiResponse<CategorieProduit[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<CategorieProduit> {
    return this.http
      .get<ApiResponse<CategorieProduit>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCategorieProduitPayload): Observable<CategorieProduit> {
    return this.http
      .post<ApiResponse<CategorieProduit>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateCategorieProduitPayload): Observable<CategorieProduit> {
    return this.http
      .put<ApiResponse<CategorieProduit>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
