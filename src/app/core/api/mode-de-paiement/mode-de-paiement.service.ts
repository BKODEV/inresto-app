import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CreateModeDePaiementPayload,
  ModeDePaiement,
  UpdateModeDePaiementPayload,
} from './mode-de-paiement.model';

@Injectable({ providedIn: 'root' })
export class ModeDePaiementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/modes-de-paiement`;

  list(): Observable<ModeDePaiement[]> {
    return this.http
      .get<ApiResponse<ModeDePaiement[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<ModeDePaiement> {
    return this.http
      .get<ApiResponse<ModeDePaiement>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateModeDePaiementPayload): Observable<ModeDePaiement> {
    return this.http
      .post<ApiResponse<ModeDePaiement>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateModeDePaiementPayload): Observable<ModeDePaiement> {
    return this.http
      .put<ApiResponse<ModeDePaiement>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
