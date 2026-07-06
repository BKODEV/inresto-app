import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { PermissionModule } from './permission.model';

interface PermissionIndex {
  modules: PermissionModule[];
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/permissions`;

  /** Catalogue groupé par module, en lecture seule (écran de rôles). */
  list(): Observable<PermissionModule[]> {
    return this.http.get<ApiResponse<PermissionIndex>>(this.base).pipe(map((r) => r.data.modules));
  }
}
