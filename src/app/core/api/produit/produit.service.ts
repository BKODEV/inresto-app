import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Statut, ApiResponse } from '../api.types';
import { CreateProduitPayload, Produit, UpdateProduitPayload } from './produit.model';

interface ProduitIndex {
  produits: Produit[];
}

@Injectable({ providedIn: 'root' })
export class ProduitService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/produits`;

  list(filters?: { categorie_id?: number; statut?: Statut }): Observable<Produit[]> {
    let params = new HttpParams().set('per_page', 200);
    if (filters?.categorie_id) {
      params = params.set('categorie_id', filters.categorie_id);
    }
    if (filters?.statut) {
      params = params.set('statut', filters.statut);
    }
    return this.http
      .get<ApiResponse<ProduitIndex>>(this.base, { params })
      .pipe(map((r) => r.data.produits));
  }

  get(id: number): Observable<Produit> {
    return this.http.get<ApiResponse<Produit>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateProduitPayload): Observable<Produit> {
    return this.http.post<ApiResponse<Produit>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateProduitPayload): Observable<Produit> {
    return this.http
      .put<ApiResponse<Produit>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Envoie/écrase la photo du produit — seule voie d'écriture du champ. Le
   * fichier doit avoir été allégé au préalable (`redimensionnerImage`).
   */
  uploadPhoto(id: number, photo: File): Observable<Produit> {
    const form = new FormData();
    form.append('photo', photo);
    return this.http
      .post<ApiResponse<Produit>>(`${this.base}/${id}/photo`, form)
      .pipe(map((r) => r.data));
  }

  /** Retire la photo (fichier effacé côté serveur, `photo` remis à null). */
  deletePhoto(id: number): Observable<Produit> {
    return this.http
      .delete<ApiResponse<Produit>>(`${this.base}/${id}/photo`)
      .pipe(map((r) => r.data));
  }
}
