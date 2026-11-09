import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { BonCuisine } from './bon-cuisine.model';

@Injectable({ providedIn: 'root' })
export class BonCuisineService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /**
   * La file de la caisse : ce qui attend d'être imprimé, tous jours confondus —
   * un bon oublié la veille doit rester visible.
   */
  aImprimer(pointDeVenteId: number): Observable<BonCuisine[]> {
    const params = new HttpParams().set('a_imprimer', 1);
    return this.http
      .get<ApiResponse<BonCuisine[]>>(
        `${this.base}/points-de-vente/${pointDeVenteId}/bons-cuisine`,
        {
          params,
        },
      )
      .pipe(map((r) => r.data));
  }

  /** Les bons d'une journée (aujourd'hui par défaut), imprimés ou non. */
  duJour(pointDeVenteId: number, jour?: string): Observable<BonCuisine[]> {
    let params = new HttpParams();
    if (jour) {
      params = params.set('jour', jour);
    }
    return this.http
      .get<ApiResponse<BonCuisine[]>>(
        `${this.base}/points-de-vente/${pointDeVenteId}/bons-cuisine`,
        {
          params,
        },
      )
      .pipe(map((r) => r.data));
  }

  /**
   * PDF 80mm, un bon par page. Sans `bonIds`, sort toute la file en attente et
   * la vide (409 si elle l'était déjà). Un bon déjà sorti revient en DUPLICATA.
   */
  imprimer(pointDeVenteId: number, bonIds?: number[]): Observable<Blob> {
    let params = new HttpParams();
    for (const id of bonIds ?? []) {
      params = params.append('bons[]', id);
    }
    return this.http.get(`${this.base}/points-de-vente/${pointDeVenteId}/bons-cuisine/pdf`, {
      params,
      responseType: 'blob',
    });
  }
}
