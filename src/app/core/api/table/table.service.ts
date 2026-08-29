import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CreateTablePayload,
  StatutTable,
  TableLotLigne,
  TableSalle,
  UpdateTablePayload,
} from './table.model';

interface TableIndex {
  tables: TableSalle[];
}

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tables`;

  /**
   * Les tables archivées sont exclues par l'API sauf `archivees` : elles ne
   * font plus partie de la salle, on ne les charge que pour les réactiver.
   */
  list(pointDeVenteId?: number, archivees = false): Observable<TableSalle[]> {
    let params = new HttpParams();
    if (pointDeVenteId) {
      params = params.set('point_de_vente_id', pointDeVenteId);
    }
    if (archivees) {
      params = params.set('archivees', 1);
    }
    return this.http
      .get<ApiResponse<TableIndex>>(this.base, { params })
      .pipe(map((r) => r.data.tables));
  }

  create(payload: CreateTablePayload): Observable<TableSalle> {
    return this.http.post<ApiResponse<TableSalle>>(this.base, payload).pipe(map((r) => r.data));
  }

  /**
   * Crée une série de tables en un appel. Tout ou rien côté API : un seul
   * numéro en défaut fait échouer le lot entier, sans rien créer.
   */
  createLot(pointDeVenteId: number, lignes: TableLotLigne[]): Observable<TableSalle[]> {
    return this.http
      .post<ApiResponse<TableSalle[]>>(`${this.base}/lot`, {
        point_de_vente_id: pointDeVenteId,
        lignes,
      })
      .pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateTablePayload): Observable<TableSalle> {
    return this.http
      .put<ApiResponse<TableSalle>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  changerStatut(id: number, statut: StatutTable): Observable<TableSalle> {
    return this.http
      .patch<ApiResponse<TableSalle>>(`${this.base}/${id}/statut`, { statut })
      .pipe(map((r) => r.data));
  }

  /**
   * Remplace le jeton public de la table : le QR déjà imprimé cesse de
   * fonctionner et doit être réimprimé.
   */
  regenererToken(id: number): Observable<TableSalle> {
    return this.http
      .post<ApiResponse<TableSalle>>(`${this.base}/${id}/regenerer-token`, {})
      .pipe(map((r) => r.data));
  }

  /**
   * Retire la table du service sans toucher à son historique. Réversible : le
   * jeton public est conservé, donc les QR déjà imprimés refonctionneront à la
   * réactivation.
   */
  archiver(id: number): Observable<TableSalle> {
    return this.http
      .post<ApiResponse<TableSalle>>(`${this.base}/${id}/archiver`, {})
      .pipe(map((r) => r.data));
  }

  reactiver(id: number): Observable<TableSalle> {
    return this.http
      .post<ApiResponse<TableSalle>>(`${this.base}/${id}/reactiver`, {})
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
