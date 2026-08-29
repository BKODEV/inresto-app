import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { MonSoldePourboire, SoldePourboire } from './pourboire.model';

@Injectable({ providedIn: 'root' })
export class PourboireService {
  private readonly http = inject(HttpClient);

  /**
   * Son propre cumul, et les reversements déjà reçus.
   *
   * Aucun identifiant n'est transmis : l'API ne rend que celui de l'appelant.
   */
  monSolde(): Observable<MonSoldePourboire> {
    return this.http
      .get<ApiResponse<MonSoldePourboire>>(`${environment.apiUrl}/pourboires/mon-solde`)
      .pipe(map((r) => r.data));
  }

  /** Soldes de tous les serveurs du périmètre, du plus dû au moins dû. */
  soldes(): Observable<SoldePourboire[]> {
    return this.http
      .get<ApiResponse<{ soldes: SoldePourboire[] }>>(`${environment.apiUrl}/pourboires/soldes`)
      .pipe(map((r) => r.data.soldes));
  }
}
