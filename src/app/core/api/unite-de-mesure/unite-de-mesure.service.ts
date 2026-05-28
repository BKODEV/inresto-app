import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CreateUniteDeMesurePayload,
  UniteDeMesure,
  UpdateUniteDeMesurePayload,
} from './unite-de-mesure.model';

@Injectable({ providedIn: 'root' })
export class UniteDeMesureService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/unites-de-mesure`;

  list(): Observable<UniteDeMesure[]> {
    return this.http
      .get<ApiResponse<UniteDeMesure[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<UniteDeMesure> {
    return this.http
      .get<ApiResponse<UniteDeMesure>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateUniteDeMesurePayload): Observable<UniteDeMesure> {
    return this.http
      .post<ApiResponse<UniteDeMesure>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateUniteDeMesurePayload): Observable<UniteDeMesure> {
    return this.http
      .put<ApiResponse<UniteDeMesure>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
