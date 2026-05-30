import { catalogBatchProcess } from './handler';

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sns');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Mock environment variables
process.env.PRODUCTS_TABLE = 'test-products';
process.env.STOCK_TABLE = 'test-stock';
process.env.CREATE_PRODUCT_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';

describe('catalogBatchProcess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process multiple SQS messages successfully', async () => {
    const mockEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Album 1',
            description: 'Test Description 1',
            price: 19.99,
            count: 10,
            artist: 'Test Artist 1',
            category: 'Music',
            genre: 'Rock',
            year: 2023,
            imageUrl: 'https://example.com/cover1.jpg'
          })
        },
        {
          body: JSON.stringify({
            title: 'Test Album 2',
            description: 'Test Description 2',
            price: 24.99,
            count: 15,
            artist: 'Test Artist 2',
            category: 'Music',
            genre: 'Pop',
            year: 2024,
            imageUrl: 'https://example.com/cover2.jpg'
          })
        }
      ]
    };

    const result = await catalogBatchProcess(mockEvent);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.processedCount).toBe(2);
    expect(responseBody.failedCount).toBe(0);
  });

  test('should handle validation errors for missing required fields', async () => {
    const mockEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Album',
            // Missing required fields: description, price, count
          })
        }
      ]
    };

    const result = await catalogBatchProcess(mockEvent);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.processedCount).toBe(0);
    expect(responseBody.failedCount).toBe(1);
    expect(responseBody.failedProducts[0].error).toContain('Missing required fields');
  });

  test('should handle empty SQS event', async () => {
    const mockEvent = { Records: [] };

    const result = await catalogBatchProcess(mockEvent);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.processedCount).toBe(0);
    expect(responseBody.failedCount).toBe(0);
  });

  test('should use default values for optional fields', async () => {
    const mockEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Album',
            description: 'Test Description',
            price: 19.99,
            count: 10
            // No optional fields: artist, category, genre, year, imageUrl
          })
        }
      ]
    };

    const result = await catalogBatchProcess(mockEvent);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.processedCount).toBe(1);
  });

  test('should handle malformed JSON', async () => {
    const mockEvent = {
      Records: [
        {
          body: 'invalid json'
        }
      ]
    };

    const result = await catalogBatchProcess(mockEvent);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.processedCount).toBe(0);
    expect(responseBody.failedCount).toBe(1);
  });
});
