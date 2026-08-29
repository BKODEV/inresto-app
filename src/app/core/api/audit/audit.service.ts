import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import {
  AnnulationAudit,
  AnnulationFiltres,
  AuditFiltres,
  PageAudit,
  RemiseAudit,
  RemiseFiltres,
} from './audit.model';

/**
 * Relecture des gestes encadrés — remises accordées et annulations.
 *
 * Distinct du journal d'activité, qui répond à « que s'est-il passé ce soir »
 * en plafonnant chaque source. Ici on interroge une période avec les filtres
 * propres à chaque nature.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  remises(filtres: RemiseFiltres = {}): Observable<PageAudit<RemiseAudit>> {
    return this.http
      .get<ApiResponse<{ remises: RemiseAudit[]; pagination: Pagination }>>(
        `${environment.apiUrl}/remises`,
        { params: this.toParams(filtres) },
      )
      .pipe(map((r) => ({ lignes: r.data.remises, pagination: r.data.pagination })));
  }

  annulations(filtres: AnnulationFiltres = {}): Observable<PageAudit<AnnulationAudit>> {
    return this.http
      .get<ApiResponse<{ annulations: AnnulationAudit[]; pagination: Pagination }>>(
        `${environment.apiUrl}/annulations`,
        { params: this.toParams(filtres) },
      )
      .pipe(map((r) => ({ lignes: r.data.annulations, pagination: r.data.pagination })));
  }

  /**
   * Sérialise les filtres non vides. `AuditFiltres` plutôt qu'un index
   * signature : les deux jeux de filtres en héritent, et `Object.entries` suffit
   * à parcourir ce qui est réellement posé.
   */
  private toParams(filtres: AuditFiltres): HttpParams {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres) as [string, unknown][]) {
      if (valeur !== undefined && valeur !== null && valeur !== '') {
        params = params.set(cle, String(valeur));
      }
    }

    return params;
  }
}
