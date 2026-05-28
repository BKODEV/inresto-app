import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiMessage, AuthUser, LoginRequest, LoginResponse, MeResponse } from './auth.models';
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from './auth.tokens';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _token = signal<string | null>(this.readStorage(AUTH_TOKEN_STORAGE_KEY));
  private readonly _user = signal<AuthUser | null>(this.parseStoredUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((res) => this.persistSession(res.data.token, res.data.user)));
  }

  me(): Observable<MeResponse> {
    return this.http
      .get<MeResponse>(`${environment.apiUrl}/auth/me`)
      .pipe(tap((res) => this.setUser(res.data)));
  }

  logout(): Observable<ApiMessage> {
    return this.http
      .post<ApiMessage>(`${environment.apiUrl}/auth/logout`, {})
      .pipe(tap(() => this.clearSession()));
  }

  clearSession(): void {
    this._token.set(null);
    this._user.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }

  private persistSession(token: string, user: AuthUser): void {
    this._token.set(token);
    this._user.set(user);
    if (this.isBrowser) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    }
  }

  private setUser(user: AuthUser): void {
    this._user.set(user);
    if (this.isBrowser) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    }
  }

  private readStorage(key: string): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem(key);
  }

  private parseStoredUser(): AuthUser | null {
    const raw = this.readStorage(AUTH_USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
