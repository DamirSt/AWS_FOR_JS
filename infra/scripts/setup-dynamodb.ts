import { DynamoDBClient, ScalarAttributeType, KeyType } from '@aws-sdk/client-dynamodb';
import { 
  CreateTableCommand, 
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  DeleteTableCommand,
  AttributeDefinition,
  KeySchemaElement,
  BillingMode
} from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand,
  GetCommand,
  ScanCommand as DocumentScanCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// AWS DynamoDB client
const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Table names
const PRODUCTS_TABLE = 'products';
const STOCK_TABLE = 'stock';

// Test data for products
const testProducts = [
  {
    id: uuidv4(),
    title: 'The Dark Side of the Moon',
    description: 'Classic progressive rock masterpiece from 1973',
    price: 3499 // Price in cents
  },
  {
    id: uuidv4(),
    title: 'Nevermind',
    description: 'Groundbreaking alternative rock album that defined the 90s',
    price: 2999
  },
  {
    id: uuidv4(),
    title: 'Led Zeppelin IV',
    description: 'Iconic hard rock album featuring "Stairway to Heaven"',
    price: 3799
  },
  {
    id: uuidv4(),
    title: 'OK Computer',
    description: 'Influential alternative rock album exploring modern alienation',
    price: 3299
  },
  {
    id: uuidv4(),
    title: 'Abbey Road',
    description: 'Final studio album from the Fab Four',
    price: 3999
  },
  {
    id: uuidv4(),
    title: 'The Velvet Underground & Nico',
    description: 'Influential art rock album with Andy Warhol artwork',
    price: 3199
  },
  {
    id: uuidv4(),
    title: 'Rumours',
    description: 'Best-selling album with classic rock anthems',
    price: 3599
  },
  {
    id: uuidv4(),
    title: 'Is This It',
    description: 'Revolutionary garage rock revival album',
    price: 2899
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
    // Delete existing tables if they exist
    console.log('Checking for existing tables...');
    try {
      await client.send(new DeleteTableCommand({ TableName: PRODUCTS_TABLE }));
      console.log('Deleted existing products table');
    } catch (error) {
      // Table doesn't exist, that's fine
    }

    try {
      await client.send(new DeleteTableCommand({ TableName: STOCK_TABLE }));
      console.log('Deleted existing stock table');
    } catch (error) {
      // Table doesn't exist, that's fine
    }

    // Create products table
    const productsTableParams = {
      TableName: PRODUCTS_TABLE,
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
      BillingMode: BillingMode.PAY_PER_REQUEST,
      StreamSpecification: {
        StreamEnabled: false
      }
    };

    await client.send(new CreateTableCommand(productsTableParams));
    console.log('Created products table');

    // Create stock table
    const stockTableParams = {
      TableName: STOCK_TABLE,
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
      BillingMode: BillingMode.PAY_PER_REQUEST,
      StreamSpecification: {
        StreamEnabled: false
      }
    };

    await client.send(new CreateTableCommand(stockTableParams));
    console.log('Created stock table');

    // Wait for tables to be created
    console.log('Waiting for tables to become active...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

async function populateTables() {
  console.log('Populating tables with test data...');

  try {
    // Populate products table
    for (const product of testProducts) {
      await docClient.send(new PutCommand({
        TableName: PRODUCTS_TABLE,
        Item: product
      }));
      console.log(`Added product: ${product.title}`);
    }

    // Populate stock table
    for (const stock of testStock) {
      await docClient.send(new PutCommand({
        TableName: STOCK_TABLE,
        Item: stock
      }));
      console.log(`Added stock for product: ${stock.product_id}, count: ${stock.count}`);
    }

  } catch (error) {
    console.error('Error populating tables:', error);
    throw error;
  }
}

async function verifyData() {
  console.log('Verifying data...');

  try {
    // Check products
    const productsResult = await docClient.send(new DocumentScanCommand({
      TableName: PRODUCTS_TABLE
    }));
    console.log(`Products table has ${productsResult.Items?.length || 0} items`);

    // Check stock
    const stockResult = await docClient.send(new DocumentScanCommand({
      TableName: STOCK_TABLE
    }));
    console.log(`Stock table has ${stockResult.Items?.length || 0} items`);

    // Display sample data
    if (productsResult.Items && productsResult.Items.length > 0) {
      console.log('Sample product:', JSON.stringify(productsResult.Items[0], null, 2));
    }

    if (stockResult.Items && stockResult.Items.length > 0) {
      console.log('Sample stock:', JSON.stringify(stockResult.Items[0], null, 2));
    }

  } catch (error) {
    console.error('Error verifying data:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Starting DynamoDB setup...');
    
    await createTables();
    await populateTables();
    await verifyData();
    
    console.log('DynamoDB setup completed successfully!');
    console.log(`Products table: ${PRODUCTS_TABLE}`);
    console.log(`Stock table: ${STOCK_TABLE}`);
    console.log(`Test products created: ${testProducts.length}`);
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main();
}

export { main, createTables, populateTables, verifyData, testProducts, testStock };
