import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { NotificationService } from '../notification.service';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class ErrorPrintInterceptor implements HttpInterceptor {
  constructor(private readonly notificationService: NotificationService) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      tap({
        error: (error: HttpErrorResponse) => {
          const url = new URL(request.url);

          // Handle specific authorization errors
          if (error.status === 401) {
            this.notificationService.showError(
              'Authorization Required: Please provide valid credentials to access this resource.',
              5000
            );
            return;
          }

          if (error.status === 403) {
            this.notificationService.showError(
              'Access Denied: You do not have permission to access this resource.',
              5000
            );
            return;
          }

          // Handle other errors
          this.notificationService.showError(
            `Request to "${url.pathname}" failed. Check the console for the details`,
            0
          );
        },
      }),
      catchError((error: HttpErrorResponse) => {
        // Re-throw the error after handling it
        return throwError(() => error);
      })
    );
  }
}
