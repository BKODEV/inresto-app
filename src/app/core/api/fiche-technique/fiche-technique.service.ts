import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { FicheTechnique, FicheTechniquePayload } from './fiche-technique.model';

interface FicheTechniqueIndex {
  fiches_techniques: FicheTechnique[];
}

@Injectable({ providedIn: 'root' })
export class FicheTechniqueService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fiches-techniques`;

  /** Fiches ACTIVES (filtre optionnel par produit). */
  list(produitId?: number): Observable<FicheTechnique[]> {
    let params = new HttpParams().set('per_page', 100);
    if (produitId) {
      params = params.set('produit_id', produitId);
    }
    return this.http
      .get<ApiResponse<FicheTechniqueIndex>>(this.base, { params })
      .pipe(map((r) => r.data.fiches_techniques));
  }

  get(id: number): Observable<FicheTechnique> {
    return this.http
      .get<ApiResponse<FicheTechnique>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  /** Crée la v1 ou archive l'active et crée la version suivante. */
  create(payload: FicheTechniquePayload): Observable<FicheTechnique> {
    return this.http.post<ApiResponse<FicheTechnique>>(this.base, payload).pipe(map((r) => r.data));
  }

  /** Même effet que create (versioning). */
  update(id: number, payload: FicheTechniquePayload): Observable<FicheTechnique> {
    return this.http
      .put<ApiResponse<FicheTechnique>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Toutes les versions d'un produit (actives + archivées). */
  historique(produitId: number): Observable<FicheTechnique[]> {
    return this.http
      .get<ApiResponse<FicheTechniqueIndex>>(`${this.base}/${produitId}/historique`)
      .pipe(map((r) => r.data.fiches_techniques));
  }
}
