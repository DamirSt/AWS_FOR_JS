import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  ScanCommand,
  GetCommand,
  BatchGetCommand,
  PutCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Error response helper
function createErrorResponse(statusCode: number, message: string, details?: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify({
      error: message,
      details,
      timestamp: new Date().toISOString()
    })
  };
}

// Success response helper
function createSuccessResponse(data: any) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

// Structured logging helper
function logRequest(functionName: string, event: any, additionalData?: any) {
  const logData = {
    timestamp: new Date().toISOString(),
    functionName,
    requestId: event.requestContext?.requestId || 'unknown',
    httpMethod: event.httpMethod || 'unknown',
    path: event.path || 'unknown',
    userAgent: event.requestContext?.identity?.userAgent || 'unknown',
    sourceIp: event.requestContext?.identity?.sourceIp || 'unknown',
    ...additionalData
  };
  
  console.log(JSON.stringify(logData));
}

function logError(functionName: string, error: any, event: any) {
  const logData = {
    timestamp: new Date().toISOString(),
    functionName,
    requestId: event.requestContext?.requestId || 'unknown',
    errorType: error.constructor.name,
    errorMessage: error.message,
    stack: error.stack,
    httpMethod: event.httpMethod || 'unknown',
    path: event.path || 'unknown'
  };
  
  console.error(JSON.stringify(logData));
}

// DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function main(event: any) {
  const functionName = 'getProductsList';
  logRequest(functionName, event);
  
  try {
    const productsTable = process.env.PRODUCTS_TABLE;
    const stockTable = process.env.STOCK_TABLE;
    
    if (!productsTable || !stockTable) {
      throw new Error('DynamoDB table names not configured');
    }

    // Scan products table
    const productsResult = await docClient.send(new ScanCommand({
      TableName: productsTable
    }));

    // Scan stock table
    const stockResult = await docClient.send(new ScanCommand({
      TableName: stockTable
    }));

    const products = productsResult.Items || [];
    const stock = stockResult.Items || [];

    // Join products with stock data
    const productsWithStock = products.map((product: any) => {
      const stockItem = stock.find((s: any) => s.product_id === product.id);
      return {
        id: product.id,
        name: product.title,
        artist: product.artist || 'Unknown Artist',
        description: product.description,
        price: product.price / 100, // Convert from cents to dollars
        category: product.category || 'Music',
        genre: product.genre || 'Rock',
        year: product.year || new Date().getFullYear(),
        count: stockItem?.count || 0,
        inStock: (stockItem?.count || 0) > 0,
        imageUrl: product.imageUrl || 'https://example.com/default-album.jpg'
      };
    });

    logRequest(functionName, event, { 
      productsReturned: productsWithStock.length,
      success: true 
    });
    
    return productsWithStock;
  } catch (error) {
    logError(functionName, error, event);
    throw error;
  }
}

export async function getProductById(event: any) {
  const functionName = 'getProductById';
  logRequest(functionName, event);
  
  try {
    // Extract productId from event (passed by API Gateway integration)
    const productId = event.productId;
    
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const productsTable = process.env.PRODUCTS_TABLE;
    const stockTable = process.env.STOCK_TABLE;
    
    if (!productsTable || !stockTable) {
      throw new Error('DynamoDB table names not configured');
    }

    // Get product from DynamoDB
    const productResult = await docClient.send(new GetCommand({
      TableName: productsTable,
      Key: { id: productId }
    }));

    const product = productResult.Item;
    
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Get stock for this product
    const stockResult = await docClient.send(new GetCommand({
      TableName: stockTable,
      Key: { product_id: productId }
    }));

    const stockItem = stockResult.Item;

    // Join product with stock data
    const productWithStock = {
      id: product.id,
      name: product.title,
      artist: product.artist || 'Unknown Artist',
      description: product.description,
      price: product.price / 100, // Convert from cents to dollars
      category: product.category || 'Music',
      genre: product.genre || 'Rock',
      year: product.year || new Date().getFullYear(),
      count: stockItem?.count || 0,
      inStock: (stockItem?.count || 0) > 0,
      imageUrl: product.imageUrl || 'https://example.com/default-album.jpg'
    };

    logRequest(functionName, event, { 
      productId,
      success: true 
    });
    
    return productWithStock;
  } catch (error) {
    logError(functionName, error, event);
    throw error;
  }
}

export async function createProduct(event: any) {
  const functionName = 'createProduct';
  logRequest(functionName, event);
  
  try {
    const productsTable = process.env.PRODUCTS_TABLE;
    const stockTable = process.env.STOCK_TABLE;
    
    if (!productsTable || !stockTable) {
      return createErrorResponse(500, 'Server configuration error', 'DynamoDB table names not configured');
    }

    // Parse request body if it's a string
    let requestBody;
    if (typeof event.body === 'string') {
      try {
        requestBody = JSON.parse(event.body);
      } catch (parseError) {
        return createErrorResponse(400, 'Invalid JSON', 'Request body contains invalid JSON');
      }
    } else {
      requestBody = event;
    }

    const { title, description, price, artist, category, genre, year, imageUrl, count } = requestBody;
    
    // Comprehensive validation with detailed error messages
    const validationErrors: string[] = [];
    
    if (!title) {
      validationErrors.push('title is required');
    } else if (typeof title !== 'string' || title.trim().length === 0) {
      validationErrors.push('title must be a non-empty string');
    } else if (title.length > 200) {
      validationErrors.push('title must be less than 200 characters');
    }
    
    if (!description) {
      validationErrors.push('description is required');
    } else if (typeof description !== 'string' || description.trim().length === 0) {
      validationErrors.push('description must be a non-empty string');
    } else if (description.length > 1000) {
      validationErrors.push('description must be less than 1000 characters');
    }
    
    if (price === undefined || price === null) {
      validationErrors.push('price is required');
    } else if (typeof price !== 'number') {
      validationErrors.push('price must be a number');
    } else if (price <= 0) {
      validationErrors.push('price must be a positive number');
    } else if (price > 99999.99) {
      validationErrors.push('price must be less than 100,000');
    }
    
    // Optional fields validation
    if (artist !== undefined) {
      if (typeof artist !== 'string') {
        validationErrors.push('artist must be a string');
      } else if (artist.length > 100) {
        validationErrors.push('artist must be less than 100 characters');
      }
    }
    
    if (category !== undefined) {
      if (typeof category !== 'string') {
        validationErrors.push('category must be a string');
      } else if (category.length > 50) {
        validationErrors.push('category must be less than 50 characters');
      }
    }
    
    if (genre !== undefined) {
      if (typeof genre !== 'string') {
        validationErrors.push('genre must be a string');
      } else if (genre.length > 50) {
        validationErrors.push('genre must be less than 50 characters');
      }
    }
    
    if (year !== undefined) {
      if (typeof year !== 'number') {
        validationErrors.push('year must be a number');
      } else if (year < 1900 || year > new Date().getFullYear() + 1) {
        validationErrors.push(`year must be between 1900 and ${new Date().getFullYear() + 1}`);
      }
    }
    
    if (count !== undefined) {
      if (typeof count !== 'number') {
        validationErrors.push('count must be a number');
      } else if (!Number.isInteger(count) || count < 0) {
        validationErrors.push('count must be a non-negative integer');
      } else if (count > 10000) {
        validationErrors.push('count must be less than 10,000');
      }
    }
    
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string') {
        validationErrors.push('imageUrl must be a string');
      } else if (imageUrl.length > 500) {
        validationErrors.push('imageUrl must be less than 500 characters');
      } else if (!imageUrl.match(/^https?:\/\/.+/)) {
        validationErrors.push('imageUrl must be a valid URL starting with http:// or https://');
      }
    }
    
    if (validationErrors.length > 0) {
      return createErrorResponse(400, 'Validation failed', validationErrors);
    }

    // Generate UUID for new product
    const productId = uuidv4();

    // Create product in DynamoDB (price in cents)
    const productItem = {
      id: productId,
      title: title.trim(),
      description: description.trim(),
      price: Math.round(price * 100), // Convert to cents
      artist: artist?.trim() || 'Unknown Artist',
      category: category?.trim() || 'Music',
      genre: genre?.trim() || 'Rock',
      year: year || new Date().getFullYear(),
      imageUrl: imageUrl?.trim() || 'https://example.com/default-album.jpg'
    };

    const stockItem = {
      product_id: productId,
      count: count || 0
    };

    // Use transaction to ensure both product and stock are created atomically
    const transactionParams = {
      TransactItems: [
        {
          Put: {
            TableName: productsTable,
            Item: productItem,
            ConditionExpression: 'attribute_not_exists(id)' // Prevent overwriting existing products
          }
        },
        {
          Put: {
            TableName: stockTable,
            Item: stockItem,
            ConditionExpression: 'attribute_not_exists(product_id)' // Prevent overwriting existing stock
          }
        }
      ]
    };

    try {
      await docClient.send(new TransactWriteCommand(transactionParams));
    } catch (transactionError: any) {
      if (transactionError.name === 'ConditionalCheckFailedException') {
        return createErrorResponse(409, 'Conflict', 'A product with this ID already exists');
      }
      throw transactionError; // Re-throw other errors to be handled by the outer catch
    }

    // Return the created product with stock info
    const createdProduct = {
      id: productId,
      name: productItem.title,
      artist: productItem.artist,
      description: productItem.description,
      price, // Return in dollars
      category: productItem.category,
      genre: productItem.genre,
      year: productItem.year,
      count: stockItem.count,
      inStock: stockItem.count > 0,
      imageUrl: productItem.imageUrl
    };

    logRequest(functionName, event, { 
      productId,
      title: productItem.title,
      price: productItem.price / 100,
      count: stockItem.count,
      success: true 
    });
    
    return createSuccessResponse(createdProduct);
  } catch (error: any) {
    logError(functionName, error, event);
    
    // Handle specific error types
    if (error.name === 'ValidationException') {
      return createErrorResponse(400, 'Invalid input', error.message);
    }
    
    if (error.name === 'ProvisionedThroughputExceededException') {
      return createErrorResponse(503, 'Service temporarily unavailable', 'Database capacity exceeded');
    }
    
    if (error.name === 'AccessDeniedException') {
      return createErrorResponse(500, 'Server configuration error', 'Database access denied');
    }
    
    // Generic server error
    return createErrorResponse(500, 'Internal server error', 'An unexpected error occurred while creating the product');
  }
}
