import { DynamoDBClient, CreateTableCommand, ScalarAttributeType, BillingMode, KeyType } from '@aws-sdk/client-dynamodb';
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Test data for products
const testProducts = [
  {
    id: uuidv4(),
    title: 'The Dark Side of the Moon',
    description: 'Classic progressive rock masterpiece from 1973',
    price: 3499, // Price in cents
    artist: 'Pink Floyd',
    category: 'Classic Rock',
    genre: 'Progressive Rock',
    year: 1973,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ab/The_Dark_Side_of_the_Moon_cover.svg/1280px-The_Dark_Side_of_the_Moon_cover.svg.png'
  },
  {
    id: uuidv4(),
    title: 'Nevermind',
    description: 'Groundbreaking alternative rock album that defined the 90s',
    price: 2999,
    artist: 'Nirvana',
    category: 'Alternative Rock',
    genre: 'Grunge',
    year: 1991,
    imageUrl: 'https://www.nirvana.com/wp-content/uploads/sites/2438/2023/10/Nevermind-compressed.jpg'
  },
  {
    id: uuidv4(),
    title: 'Led Zeppelin IV',
    description: 'Iconic hard rock album featuring "Stairway to Heaven"',
    price: 3799,
    artist: 'Led Zeppelin',
    category: 'Classic Rock',
    genre: 'Hard Rock',
    year: 1971,
    imageUrl: 'https://m.media-amazon.com/images/I/81x364UAGAL._AC_SX679_.jpg'
  },
  {
    id: uuidv4(),
    title: 'OK Computer',
    description: 'Influential alternative rock album exploring modern alienation',
    price: 3299,
    artist: 'Radiohead',
    category: 'Alternative Rock',
    genre: 'Art Rock',
    year: 1997,
    imageUrl: 'https://cdn-images.dzcdn.net/images/cover/05a186e0a859a36f9cd51cdae2158fe1/0x1900-000000-80-0-0.jpg'
  },
  {
    id: uuidv4(),
    title: 'Abbey Road',
    description: 'Final studio album from the Fab Four',
    price: 3999,
    artist: 'The Beatles',
    category: 'Classic Rock',
    genre: 'Rock',
    year: 1969,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/The_Beatles_Abbey_Road_album_cover.jpg'
  },
  {
    id: uuidv4(),
    title: 'The Velvet Underground & Nico',
    description: 'Influential art rock album with Andy Warhol artwork',
    price: 3199,
    artist: 'The Velvet Underground',
    category: 'Alternative Rock',
    genre: 'Art Rock',
    year: 1967,
    imageUrl: 'https://m.media-amazon.com/images/I/61wJx-+0I2L._UF1000,1000_QL80_.jpg'
  },
  {
    id: uuidv4(),
    title: 'Rumours',
    description: 'Best-selling album with classic rock anthems',
    price: 3599,
    artist: 'Fleetwood Mac',
    category: 'Classic Rock',
    genre: 'Soft Rock',
    year: 1977,
    imageUrl: 'https://m.media-amazon.com/images/I/71BekDJBb3L._UF1000,1000_QL80_.jpg'
  },
  {
    id: uuidv4(),
    title: 'Is This It',
    description: 'Revolutionary garage rock revival album',
    price: 2899,
    artist: 'The Strokes',
    category: 'Alternative Rock',
    genre: 'Garage Rock',
    year: 2001,
    imageUrl: 'https://static.wixstatic.com/media/82fcff_03fe4045dcd04b08bebf07b877dc0cd5~mv2.jpg/v1/fill/w_900,h_900,al_c,q_85/82fcff_03fe4045dcd04b08bebf07b877dc0cd5~mv2.jpg'
  }
];

// Test data for stock
const testStock = testProducts.map((product, index) => ({
  product_id: product.id,
  count: Math.floor(Math.random() * 10) + 1 // Random count between 1-10
}));

async function createTables() {
  console.log('Creating DynamoDB tables...');

  try {
    // Create products table
    const productsTableParams = {
      TableName: 'products',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: ScalarAttributeType.S // String
        }
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: KeyType.HASH // Primary key
        }
      ],
      BillingMode: BillingMode.PAY_PER_REQUEST
    };

    try {
      await client.send(new CreateTableCommand(productsTableParams));
      console.log('Created products table');
    } catch (error: any) {
      if (error.name === 'ResourceInUseException') {
        console.log('Products table already exists');
      } else {
        throw error;
      }
    }

    // Create stock table
    const stockTableParams = {
      TableName: 'stock',
      AttributeDefinitions: [
        {
          AttributeName: 'product_id',
          AttributeType: ScalarAttributeType.S // String
        }
      ],
      KeySchema: [
        {
          AttributeName: 'product_id',
          KeyType: KeyType.HASH // Primary key
        }
      ],
      BillingMode: BillingMode.PAY_PER_REQUEST
    };

    try {
      await client.send(new CreateTableCommand(stockTableParams));
      console.log('Created stock table');
    } catch (error: any) {
      if (error.name === 'ResourceInUseException') {
        console.log('Stock table already exists');
      } else {
        throw error;
      }
    }

    // Wait for tables to be created
    console.log('Waiting for tables to become active...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

async function populateTables() {
  console.log('Populating DynamoDB tables with test data...');

  try {
    // Clear existing data first
    console.log('Clearing existing data...');
    
    try {
      const existingProducts = await docClient.send(new ScanCommand({
        TableName: 'products'
      }));

      const existingStock = await docClient.send(new ScanCommand({
        TableName: 'stock'
      }));

      // Delete existing items (in production you'd want to be more careful with this)
      for (const item of existingStock.Items || []) {
        await docClient.send(new PutCommand({
          TableName: 'stock',
          Item: { ...item, count: 0 } // Set count to 0 instead of deleting
        }));
      }
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('Tables don\'t exist yet, will create them');
      } else {
        throw error;
      }
    }

    // Populate products table
    console.log('Adding products...');
    for (const product of testProducts) {
      await docClient.send(new PutCommand({
        TableName: 'products',
        Item: product
      }));
      console.log(`Added product: ${product.title}`);
    }

    // Populate stock table
    console.log('Adding stock...');
    for (const stock of testStock) {
      await docClient.send(new PutCommand({
        TableName: 'stock',
        Item: stock
      }));
      console.log(`Added stock for product: ${stock.product_id}, count: ${stock.count}`);
    }

    console.log('Data population completed successfully!');
    
    // Verify data
    const productsResult = await docClient.send(new ScanCommand({
      TableName: 'products'
    }));
    
    const stockResult = await docClient.send(new ScanCommand({
      TableName: 'stock'
    }));

    console.log(`Products table now has ${productsResult.Items?.length || 0} items`);
    console.log(`Stock table now has ${stockResult.Items?.length || 0} items`);

  } catch (error) {
    console.error('Error populating tables:', error);
    throw error;
  }
}

async function main() {
  try {
    await createTables();
    await populateTables();
    console.log('SUCCESS: Database populated with test data!');
  } catch (error) {
    console.error('FAILED: Could not populate database:', error);
    process.exit(1);
  }
}

// Run the population
if (require.main === module) {
  main();
}

export { main, populateTables, testProducts, testStock };
