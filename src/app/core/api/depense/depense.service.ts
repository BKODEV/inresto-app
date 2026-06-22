import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { CreateDepensePayload, Depense } from './depense.model';

@Injectable({ providedIn: 'root' })
export class DepenseService {
  private readonly http = inject(HttpClient);

  /** Enregistre une charge hors stock sur un budget. */
  create(budgetId: number, payload: CreateDepensePayload): Observable<Depense> {
    return this.http
      .post<ApiResponse<Depense>>(`${environment.apiUrl}/budgets/${budgetId}/depenses`, payload)
      .pipe(map((r) => r.data));
  }
}
