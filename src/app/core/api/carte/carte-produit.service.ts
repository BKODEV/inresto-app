import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CarteProduit,
  CarteProduitLotLigne,
  CreateCarteProduitPayload,
  UpdateCarteProduitPayload,
} from './carte-produit.model';

interface CarteProduitIndex {
  produits: CarteProduit[];
}

@Injectable({ providedIn: 'root' })
export class CarteProduitService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cartes`;

  /** Lignes (produits + prix) d'une carte. */
  list(carteId: number): Observable<CarteProduit[]> {
    return this.http
      .get<ApiResponse<CarteProduitIndex>>(`${this.base}/${carteId}/produits`)
      .pipe(map((r) => r.data.produits));
  }

  create(carteId: number, payload: CreateCarteProduitPayload): Observable<CarteProduit> {
    return this.http
      .post<ApiResponse<CarteProduit>>(`${this.base}/${carteId}/produits`, payload)
      .pipe(map((r) => r.data));
  }

  /**
   * Ajoute plusieurs produits en une requête (tout ou rien côté API : un seul
   * produit en défaut fait échouer le lot entier).
   */
  createLot(carteId: number, lignes: CarteProduitLotLigne[]): Observable<CarteProduit[]> {
    return this.http
      .post<ApiResponse<CarteProduit[]>>(`${this.base}/${carteId}/produits/lot`, { lignes })
      .pipe(map((r) => r.data));
  }

  update(
    carteId: number,
    ligneId: number,
    payload: UpdateCarteProduitPayload,
  ): Observable<CarteProduit> {
    return this.http
      .patch<ApiResponse<CarteProduit>>(`${this.base}/${carteId}/produits/${ligneId}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(carteId: number, ligneId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${carteId}/produits/${ligneId}`);
  }
}
