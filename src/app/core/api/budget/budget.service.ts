import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { Budget, CreateBudgetPayload, UpdateBudgetPayload } from './budget.model';

interface BudgetList {
  budgets: Budget[];
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/budgets`;

  /** Budgets d'un site, chacun avec ses champs de consommation calculés. */
  listForSite(siteId: number): Observable<Budget[]> {
    return this.http
      .get<ApiResponse<BudgetList>>(`${environment.apiUrl}/sites/${siteId}/budgets`)
      .pipe(map((r) => r.data.budgets));
  }

  /** Détail d'un budget pour un mois (YYYY-MM) avec ses dépenses ; 404 si absent. */
  showForMonth(siteId: number, mois: string): Observable<Budget> {
    return this.http
      .get<ApiResponse<Budget>>(`${environment.apiUrl}/sites/${siteId}/budgets/${mois}`)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<Budget> {
    return this.http.get<ApiResponse<Budget>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateBudgetPayload): Observable<Budget> {
    return this.http.post<ApiResponse<Budget>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateBudgetPayload): Observable<Budget> {
    return this.http.put<ApiResponse<Budget>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
