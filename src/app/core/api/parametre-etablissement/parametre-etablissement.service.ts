import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  ParametreEtablissement,
  UpsertParametreEtablissementPayload,
} from './parametre-etablissement.model';

@Injectable({ providedIn: 'root' })
export class ParametreEtablissementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sites`;

  /** Fiche du site (le backend renvoie 404 tant qu'elle n'a pas été créée). */
  get(siteId: number): Observable<ParametreEtablissement> {
    return this.http
      .get<ApiResponse<ParametreEtablissement>>(`${this.base}/${siteId}/parametres`)
      .pipe(map((r) => r.data));
  }

  /** Upsert (crée ou met à jour la fiche unique du site). */
  upsert(
    siteId: number,
    payload: UpsertParametreEtablissementPayload,
  ): Observable<ParametreEtablissement> {
    return this.http
      .put<ApiResponse<ParametreEtablissement>>(`${this.base}/${siteId}/parametres`, payload)
      .pipe(map((r) => r.data));
  }

  /** Envoie/écrase le logo (la fiche doit déjà exister). */
  uploadLogo(siteId: number, logo: File): Observable<ParametreEtablissement> {
    const form = new FormData();
    form.append('logo', logo);
    return this.http
      .post<ApiResponse<ParametreEtablissement>>(`${this.base}/${siteId}/parametres/logo`, form)
      .pipe(map((r) => r.data));
  }

  /** Supprime le logo (fichier effacé, `logo_path` remis à null). */
  deleteLogo(siteId: number): Observable<ParametreEtablissement> {
    return this.http
      .delete<ApiResponse<ParametreEtablissement>>(`${this.base}/${siteId}/parametres/logo`)
      .pipe(map((r) => r.data));
  }
}
