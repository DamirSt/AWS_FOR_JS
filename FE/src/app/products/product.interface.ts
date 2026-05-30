export interface Product {
  id: string;
  name: string;
  artist: string;
  description: string;
  price: number;
  category: string;
  genre: string;
  year: number;
  count: number;
  inStock: boolean;
  imageUrl: string;
}

export interface ProductCheckout extends Product {
  orderedCount: number;
  /** orderedCount * price */
  totalPrice: number;
}
