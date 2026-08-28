import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  CreatePosteCuisinePayload,
  PosteCuisine,
  UpdatePosteCuisinePayload,
} from './poste-cuisine.model';

@Injectable({ providedIn: 'root' })
export class PosteCuisineService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametres/postes-cuisine`;

  /** Sans `pointDeVenteId`, tous les postes du périmètre de l'utilisateur. */
  list(pointDeVenteId?: number): Observable<PosteCuisine[]> {
    let params = new HttpParams();
    if (pointDeVenteId) {
      params = params.set('point_de_vente_id', pointDeVenteId);
    }
    return this.http
      .get<ApiResponse<PosteCuisine[]>>(this.base, { params })
      .pipe(map((r) => r.data));
  }

  create(payload: CreatePosteCuisinePayload): Observable<PosteCuisine> {
    return this.http.post<ApiResponse<PosteCuisine>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdatePosteCuisinePayload): Observable<PosteCuisine> {
    return this.http
      .put<ApiResponse<PosteCuisine>>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
