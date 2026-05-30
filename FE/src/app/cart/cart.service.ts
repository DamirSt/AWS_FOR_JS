import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Product } from '../products/product.interface';
import { ProductsService } from '../products/products.service';
import { CONFIG_TOKEN } from '../core/injection-tokens/config.token';
import { take } from 'rxjs/operators';

type CartItemApi = {
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
  };
  count: number;
};

type PutCartPayload = {
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
  };
  count: number;
};

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly config = inject(CONFIG_TOKEN, { optional: true });
  private readonly productsService = inject(ProductsService, {
    optional: true,
  });

  /** Key - item id, value - ordered amount */
  #cart = signal<Record<string, number>>({});

  cart = this.#cart.asReadonly();

  totalInCart = computed(() => {
    const values = Object.values(this.cart());

    if (!values.length) {
      return 0;
    }

    return values.reduce((acc, val) => acc + val, 0);
  });

  constructor() {
    this.loadFromApi();
  }

  addItem(id: string, product?: Product): void {
    this.updateCount(id, 1);
    this.syncItem(id, product);
  }

  removeItem(id: string): void {
    this.updateCount(id, -1);
    this.syncItem(id);
  }

  empty(): void {
    this.#cart.set({});

    if (!this.cartApiEnabled()) {
      return;
    }

    this.http?.delete(this.getCartApiUrl()).pipe(take(1)).subscribe({
      error: (error) => {
        console.warn('Failed to clear cart via API', error);
      },
    });
  }

  private updateCount(id: string, type: 1 | -1): void {
    const val = this.cart();
    const newVal = {
      ...val,
    };

    if (!(id in newVal)) {
      newVal[id] = 0;
    }

    if (type === 1) {
      newVal[id] = ++newVal[id];
      this.#cart.set(newVal);
      return;
    }

    if (newVal[id] === 0) {
      console.warn('No match. Skipping...');
      return;
    }

    newVal[id]--;

    if (!newVal[id]) {
      delete newVal[id];
    }

    this.#cart.set(newVal);
  }

  private cartApiEnabled(): boolean {
    return !!(
      this.http &&
      this.config &&
      this.productsService &&
      this.config.apiEndpointsEnabled.cart
    );
  }

  private getCartApiUrl(): string {
    return Location.joinWithSlash(this.config!.apiEndpoints.cart, 'api/profile/cart');
  }

  private loadFromApi(): void {
    if (!this.cartApiEnabled()) {
      return;
    }

    this.http
      ?.get<CartItemApi[]>(this.getCartApiUrl())
      .pipe(take(1))
      .subscribe({
        next: (items) => this.updateFromApi(items),
        error: (error) => {
          console.warn('Failed to load cart from API', error);
        },
      });
  }

  private syncItem(id: string, product?: Product): void {
    if (!this.cartApiEnabled()) {
      return;
    }

    const count = this.cart()[id] ?? 0;

    if (count === 0) {
      this.putCart({
        product: this.mapProduct(product) ?? {
          id,
          title: '',
          description: '',
          price: 0,
        },
        count: 0,
      });
      return;
    }

    const mappedProduct = this.mapProduct(product);

    if (mappedProduct) {
      this.putCart({
        product: mappedProduct,
        count,
      });
      return;
    }

    this.productsService
      ?.getProducts()
      .pipe(take(1))
      .subscribe({
        next: (products) => {
          const product = products.find((item) => item.id === id);

          if (!product) {
            console.warn('Cannot sync cart item: product not found', id);
            return;
          }

          const mapped = this.mapProduct(product);

          if (!mapped) {
            console.warn('Cannot sync cart item: product mapping failed', id);
            return;
          }

          this.putCart({
            product: mapped,
            count,
          });
        },
        error: (error) => {
          console.warn('Failed to resolve product for cart sync', error);
        },
      });
  }

  private putCart(payload: PutCartPayload): void {
    this.http
      ?.put<CartItemApi[]>(this.getCartApiUrl(), payload)
      .pipe(take(1))
      .subscribe({
        next: (items) => this.updateFromApi(items),
        error: (error) => {
          console.warn('Failed to sync cart item with API', error);
        },
      });
  }

  private updateFromApi(items: CartItemApi[]): void {
    const cart = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.product.id] = item.count;
      return acc;
    }, {});

    this.#cart.set(cart);
  }

  private mapProduct(product?: Product): PutCartPayload['product'] | undefined {
    if (!product) {
      return undefined;
    }

    return {
      id: product.id,
      title: product.name,
      description: product.description,
      price: product.price,
    };
  }

}
