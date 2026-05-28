import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { Caisse, CreateCaissePayload, UpdateCaissePayload } from './caisse.model';

@Injectable({ providedIn: 'root' })
export class CaisseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/caisses`;

  list(): Observable<Caisse[]> {
    return this.http
      .get<ApiResponse<Caisse[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<Caisse> {
    return this.http
      .get<ApiResponse<Caisse>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCaissePayload): Observable<Caisse> {
    return this.http
      .post<ApiResponse<Caisse>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateCaissePayload): Observable<Caisse> {
    return this.http
      .put<ApiResponse<Caisse>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
