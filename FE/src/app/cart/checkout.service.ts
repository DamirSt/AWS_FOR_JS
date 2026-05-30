import { inject, Injectable } from '@angular/core';
import { CartService } from './cart.service';
import { ProductsService } from '../products/products.service';
import { Observable } from 'rxjs';
import { ProductCheckout } from '../products/product.interface';
import { map, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class CheckoutService {
  private readonly cartService = inject(CartService);
  private readonly productsService = inject(ProductsService);

  getProductsForCheckout(): Observable<ProductCheckout[]> {
    return toObservable(this.cartService.cart).pipe(
      switchMap((cart) =>
        this.productsService.getProductsForCheckout(Object.keys(cart)).pipe(
          map((products) =>
            products.map((product) => ({
              ...product,
              orderedCount: cart[product.id],
              totalPrice: +(cart[product.id] * product.price).toFixed(2),
            })),
          ),
        ),
      ),
    );
  }
}
