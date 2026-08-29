import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { JournalFiltres, JournalIndex } from './journal.model';

@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/journal`;

  /**
   * Sans plage de dates, l'API se limite à la journée courante : le journal
   * assemble plusieurs sources en mémoire et doit rester borné.
   */
  list(filtres: JournalFiltres = {}): Observable<JournalIndex> {
    let params = new HttpParams();
    if (filtres.site_id) {
      params = params.set('site_id', filtres.site_id);
    }
    if (filtres.point_de_vente_id) {
      params = params.set('point_de_vente_id', filtres.point_de_vente_id);
    }
    if (filtres.date_debut) {
      params = params.set('date_debut', filtres.date_debut);
    }
    if (filtres.date_fin) {
      params = params.set('date_fin', filtres.date_fin);
    }
    for (const type of filtres.type ?? []) {
      params = params.append('type[]', type);
    }
    return this.http.get<ApiResponse<JournalIndex>>(this.base, { params }).pipe(map((r) => r.data));
  }
}
