import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { SoldePourboire } from './pourboire.model';

@Injectable({ providedIn: 'root' })
export class PourboireService {
  private readonly http = inject(HttpClient);

  /** Soldes de tous les serveurs du périmètre, du plus dû au moins dû. */
  soldes(): Observable<SoldePourboire[]> {
    return this.http
      .get<ApiResponse<{ soldes: SoldePourboire[] }>>(`${environment.apiUrl}/pourboires/soldes`)
      .pipe(map((r) => r.data.soldes));
  }
}
