import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'authorization_token';
  private readonly USERNAME = 'damirstan';
  private readonly PASSWORD = 'TEST_PASSWORD';

  constructor() { }

  /**
   * Generate Basic Auth token and store it in localStorage
   */
  generateAndStoreToken(): string {
    const credentials = `${this.USERNAME}:${this.PASSWORD}`;
    const token = btoa(credentials);
    localStorage.setItem(this.TOKEN_KEY, token);
    return token;
  }

  /**
   * Get authorization token from localStorage
   */
  getAuthorizationToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get Authorization header value
   */
  getAuthorizationHeader(): string | null {
    const token = this.getAuthorizationToken();
    return token ? `Basic ${token}` : null;
  }

  /**
   * Clear authorization token from localStorage
   */
  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAuthorizationToken();
  }

  /**
   * Initialize authentication by generating and storing token
   */
  initializeAuth(): void {
    if (!this.isAuthenticated()) {
      this.generateAndStoreToken();
    }
  }
}
