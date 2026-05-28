import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiCall = req.url.startsWith(environment.apiUrl);
  const token = auth.token();

  const authedReq = isApiCall && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    : isApiCall
      ? req.clone({ setHeaders: { Accept: 'application/json' } })
      : req;

  return next(authedReq).pipe(
    catchError((err) => {
      if (isApiCall && err?.status === 401 && auth.isAuthenticated()) {
        auth.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
