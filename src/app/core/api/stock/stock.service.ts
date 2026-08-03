import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import { Stock } from './stock.model';
import { MouvementStock, MouvementType } from './mouvement-stock.model';

export interface StockFilters {
  site_id?: number;
  /** Ne remonter que les matières retombées au niveau de leur seuil d'alerte. */
  sous_seuil?: boolean;
  per_page?: number;
  page?: number;
}

export interface StockPage {
  stocks: Stock[];
  /** Somme des valeurs de la page courante (pas du parc entier). */
  total_valorise: number;
  pagination: Pagination;
}

export interface MouvementFilters {
  site_id?: number;
  matiere_premiere_id?: number;
  type?: MouvementType;
  /** Bornes incluses, au format `YYYY-MM-DD` (le serveur élargit au jour entier). */
  date_debut?: string;
  date_fin?: string;
  per_page?: number;
  page?: number;
}

export interface MouvementPage {
  mouvements: MouvementStock[];
  pagination: Pagination;
}

/**
 * Client de l'état du stock par site (écran opérationnel, permission
 * `stock.view`). Distinct du module Reporting, qui agrège sur une période.
 */
@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stock`;

  list(filters: StockFilters = {}): Observable<StockPage> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 100);
    if (filters.site_id) {
      params = params.set('site_id', filters.site_id);
    }
    if (filters.sous_seuil) {
      params = params.set('sous_seuil', 1);
    }
    if (filters.page) {
      params = params.set('page', filters.page);
    }
    return this.http.get<ApiResponse<StockPage>>(this.base, { params }).pipe(map((r) => r.data));
  }

  /** Journal des mouvements, du plus récent au plus ancien. */
  mouvements(filters: MouvementFilters = {}): Observable<MouvementPage> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 50);
    if (filters.site_id) {
      params = params.set('site_id', filters.site_id);
    }
    if (filters.matiere_premiere_id) {
      params = params.set('matiere_premiere_id', filters.matiere_premiere_id);
    }
    if (filters.type) {
      params = params.set('type', filters.type);
    }
    if (filters.date_debut) {
      params = params.set('date_debut', filters.date_debut);
    }
    if (filters.date_fin) {
      params = params.set('date_fin', filters.date_fin);
    }
    if (filters.page) {
      params = params.set('page', filters.page);
    }
    return this.http
      .get<ApiResponse<MouvementPage>>(`${this.base}/mouvements`, { params })
      .pipe(map((r) => r.data));
  }
}
