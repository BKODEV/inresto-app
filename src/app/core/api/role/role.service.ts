import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { CreateRolePayload, Role, UpdateRolePayload } from './role.model';

interface RoleIndex {
  roles: Role[];
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/roles`;

  list(): Observable<Role[]> {
    return this.http.get<ApiResponse<RoleIndex>>(this.base).pipe(map((r) => r.data.roles));
  }

  get(id: number): Observable<Role> {
    return this.http.get<ApiResponse<Role>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateRolePayload): Observable<Role> {
    return this.http.post<ApiResponse<Role>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UpdateRolePayload): Observable<Role> {
    return this.http.put<ApiResponse<Role>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<unknown>(`${this.base}/${id}`).pipe(map(() => undefined));
  }
}
