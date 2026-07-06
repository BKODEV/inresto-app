import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { CreateUserPayload, UpdateUserPayload, User, UserFilters } from './user.model';

interface UserIndex {
  users: User[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(filters: UserFilters = {}): Observable<User[]> {
    let params = new HttpParams();
    if (filters.site_id) {
      params = params.set('site_id', String(filters.site_id));
    }
    if (filters.role) {
      params = params.set('role', filters.role);
    }
    if (filters.statut) {
      params = params.set('statut', filters.statut);
    }
    if (filters.q) {
      params = params.set('q', filters.q);
    }

    return this.http
      .get<ApiResponse<UserIndex>>(this.base, { params })
      .pipe(map((r) => r.data.users));
  }

  get(id: string): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: CreateUserPayload): Observable<User> {
    return this.http.post<ApiResponse<User>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<unknown>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  activer(id: string): Observable<User> {
    return this.http
      .post<ApiResponse<User>>(`${this.base}/${id}/activer`, {})
      .pipe(map((r) => r.data));
  }

  desactiver(id: string): Observable<User> {
    return this.http
      .post<ApiResponse<User>>(`${this.base}/${id}/desactiver`, {})
      .pipe(map((r) => r.data));
  }

  /** Réinitialisation mode a : l'admin définit directement un nouveau mot de passe. */
  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/${id}/reset-password`, { new_password: newPassword })
      .pipe(map(() => undefined));
  }

  /** Réinitialisation mode b : l'admin déclenche l'envoi d'un lien par email. */
  sendResetLink(id: string): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/${id}/send-reset-link`, {})
      .pipe(map(() => undefined));
  }
}
