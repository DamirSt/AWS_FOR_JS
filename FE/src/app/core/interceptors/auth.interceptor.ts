import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Only add auth header to requests to the import service
    if (request.url.includes('/import')) {
      const authHeader = this.authService.getAuthorizationHeader();
      
      if (authHeader) {
        const authRequest = request.clone({
          headers: request.headers.set('Authorization', authHeader)
        });
        return next.handle(authRequest);
      }
    }

    return next.handle(request);
  }
}
