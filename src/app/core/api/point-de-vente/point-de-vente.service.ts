import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CreatePointDeVentePayload,
  PointDeVente,
  UpdatePointDeVentePayload,
} from './point-de-vente.model';

@Injectable({ providedIn: 'root' })
export class PointDeVenteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/points-de-vente`;

  list(): Observable<PointDeVente[]> {
    return this.http
      .get<ApiResponse<PointDeVente[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<PointDeVente> {
    return this.http
      .get<ApiResponse<PointDeVente>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreatePointDeVentePayload): Observable<PointDeVente> {
    return this.http
      .post<ApiResponse<PointDeVente>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdatePointDeVentePayload): Observable<PointDeVente> {
    return this.http
      .put<ApiResponse<PointDeVente>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
