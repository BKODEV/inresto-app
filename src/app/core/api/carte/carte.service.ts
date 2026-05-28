import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { Carte, CreateCartePayload, UpdateCartePayload } from './carte.model';

@Injectable({ providedIn: 'root' })
export class CarteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/cartes`;

  list(): Observable<Carte[]> {
    return this.http
      .get<ApiResponse<Carte[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<Carte> {
    return this.http
      .get<ApiResponse<Carte>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCartePayload): Observable<Carte> {
    return this.http
      .post<ApiResponse<Carte>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateCartePayload): Observable<Carte> {
    return this.http
      .put<ApiResponse<Carte>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
