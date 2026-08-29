import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { CreateVersementPayload, Versement } from './versement.model';

@Injectable({ providedIn: 'root' })
export class VersementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/caisses`;

  /** Versements d'une caisse, du plus récent au plus ancien. */
  list(caisseId: number): Observable<Versement[]> {
    return this.http
      .get<ApiResponse<Versement[]>>(`${this.base}/${caisseId}/versements`)
      .pipe(map((r) => r.data));
  }

  create(caisseId: number, payload: CreateVersementPayload): Observable<Versement> {
    return this.http
      .post<ApiResponse<Versement>>(`${this.base}/${caisseId}/versements`, payload)
      .pipe(map((r) => r.data));
  }
}
