// Mock product data - Vinyl Records
const mockProducts = [
  {
    id: '1',
    name: 'The Dark Side of the Moon',
    artist: 'Pink Floyd',
    description: 'Classic progressive rock masterpiece from 1973',
    price: 34.99,
    category: 'Classic Rock',
    genre: 'Progressive Rock',
    year: 1973,
    inStock: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ab/The_Dark_Side_of_the_Moon_cover.svg/1280px-The_Dark_Side_of_the_Moon_cover.svg.png'
  },
  {
    id: '2',
    name: 'Nevermind',
    artist: 'Nirvana',
    description: 'Groundbreaking alternative rock album that defined the 90s',
    price: 29.99,
    category: 'Alternative Rock',
    genre: 'Grunge',
    year: 1991,
    inStock: true,
    imageUrl: 'https://www.nirvana.com/wp-content/uploads/sites/2438/2023/10/Nevermind-compressed.jpg'
  },
  {
    id: '3',
    name: 'Led Zeppelin IV',
    artist: 'Led Zeppelin',
    description: 'Iconic hard rock album featuring "Stairway to Heaven"',
    price: 37.99,
    category: 'Classic Rock',
    genre: 'Hard Rock',
    year: 1971,
    inStock: false,
    imageUrl: 'https://m.media-amazon.com/images/I/81x364UAGAL._AC_SX679_.jpg'
  },
  {
    id: '4',
    name: 'OK Computer',
    artist: 'Radiohead',
    description: 'Influential alternative rock album exploring modern alienation',
    price: 32.99,
    category: 'Alternative Rock',
    genre: 'Art Rock',
    year: 1997,
    inStock: true,
    imageUrl: 'https://cdn-images.dzcdn.net/images/cover/05a186e0a859a36f9cd51cdae2158fe1/0x1900-000000-80-0-0.jpg'
  },
  {
    id: '5',
    name: 'Abbey Road',
    artist: 'The Beatles',
    description: 'Final studio album from the Fab Four',
    price: 39.99,
    category: 'Classic Rock',
    genre: 'Rock',
    year: 1969,
    inStock: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/The_Beatles_Abbey_Road_album_cover.jpg'
  },
  {
    id: '6',
    name: 'The Velvet Underground & Nico',
    artist: 'The Velvet Underground',
    description: 'Influential art rock album with Andy Warhol artwork',
    price: 31.99,
    category: 'Alternative Rock',
    genre: 'Art Rock',
    year: 1967,
    inStock: true,
    imageUrl: 'https://m.media-amazon.com/images/I/61wJx-+0I2L._UF1000,1000_QL80_.jpg'
  },
  {
    id: '7',
    name: 'Rumours',
    artist: 'Fleetwood Mac',
    description: 'Best-selling album with classic rock anthems',
    price: 35.99,
    category: 'Classic Rock',
    genre: 'Soft Rock',
    year: 1977,
    inStock: false,
    imageUrl: 'https://m.media-amazon.com/images/I/71BekDJBb3L._UF1000,1000_QL80_.jpg'
  },
  {
    id: '8',
    name: 'Is This It',
    artist: 'The Strokes',
    description: 'Revolutionary garage rock revival album',
    price: 28.99,
    category: 'Alternative Rock',
    genre: 'Garage Rock',
    year: 2001,
    inStock: true,
    imageUrl: 'https://static.wixstatic.com/media/82fcff_03fe4045dcd04b08bebf07b877dc0cd5~mv2.jpg/v1/fill/w_900,h_900,al_c,q_85/82fcff_03fe4045dcd04b08bebf07b877dc0cd5~mv2.jpg'
  }
];

export async function main(event: any) {
  try {
    // Return the full array of products
    return mockProducts;
  } catch (error) {
    console.error('Error in getProductsList:', error);
    return {
      error: 'Internal server error',
      message: 'Failed to retrieve products'
    };
  }
}

export async function getProductById(event: any) {
  try {
    // Extract productId from request template
    const productId = event.productId;
    
    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Find product by ID
    const product = mockProducts.find(p => p.id === productId);
    
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Return the found product
    return product;
  } catch (error) {
    console.error('Error in getProductById:', error);
    throw error;
  }
}
