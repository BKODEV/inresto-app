import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Pagination } from '../api.types';
import {
  CommandeFournisseur,
  CreateCommandeFournisseurPayload,
  LigneCommandeFournisseur,
  LigneCommandePayload,
  StatutCommandeFournisseur,
  UpdateCommandeFournisseurPayload,
} from './commande-fournisseur.model';

export interface CommandeFournisseurFilters {
  statut?: StatutCommandeFournisseur;
  fournisseur_id?: number;
  per_page?: number;
  page?: number;
}

export interface CommandeFournisseurPage {
  commandes: CommandeFournisseur[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class CommandeFournisseurService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/commandes-fournisseur`;

  list(filters: CommandeFournisseurFilters = {}): Observable<CommandeFournisseurPage> {
    let params = new HttpParams().set('per_page', filters.per_page ?? 50);
    if (filters.statut) {
      params = params.set('statut', filters.statut);
    }
    if (filters.fournisseur_id) {
      params = params.set('fournisseur_id', filters.fournisseur_id);
    }
    if (filters.page) {
      params = params.set('page', filters.page);
    }
    return this.http.get<ApiResponse<CommandeFournisseurPage>>(this.base, { params }).pipe(
      map((r) => r.data),
    );
  }

  get(id: number): Observable<CommandeFournisseur> {
    return this.http
      .get<ApiResponse<CommandeFournisseur>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCommandeFournisseurPayload): Observable<CommandeFournisseur> {
    return this.http
      .post<ApiResponse<CommandeFournisseur>>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateCommandeFournisseurPayload): Observable<CommandeFournisseur> {
    return this.http
      .put<ApiResponse<CommandeFournisseur>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  envoyer(id: number): Observable<CommandeFournisseur> {
    return this.http
      .post<ApiResponse<CommandeFournisseur>>(`${this.base}/${id}/envoyer`, {})
      .pipe(map((r) => r.data));
  }

  annuler(id: number): Observable<CommandeFournisseur> {
    return this.http
      .post<ApiResponse<CommandeFournisseur>>(`${this.base}/${id}/annuler`, {})
      .pipe(map((r) => r.data));
  }

  // ── Lignes (modifiables uniquement en brouillon) ────────────────────────

  addLigne(commandeId: number, payload: LigneCommandePayload): Observable<LigneCommandeFournisseur> {
    return this.http
      .post<ApiResponse<LigneCommandeFournisseur>>(`${this.base}/${commandeId}/lignes`, payload)
      .pipe(map((r) => r.data));
  }

  updateLigne(
    commandeId: number,
    ligneId: number,
    payload: Partial<LigneCommandePayload>,
  ): Observable<LigneCommandeFournisseur> {
    return this.http
      .put<
        ApiResponse<LigneCommandeFournisseur>
      >(`${this.base}/${commandeId}/lignes/${ligneId}`, payload)
      .pipe(map((r) => r.data));
  }

  deleteLigne(commandeId: number, ligneId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${commandeId}/lignes/${ligneId}`);
  }
}
