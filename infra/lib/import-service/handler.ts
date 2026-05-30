import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import csv from 'csv-parser';

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
      details
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

// S3 client
const s3Client = new S3Client({});

// SQS client
const sqsClient = new SQSClient({});

export async function importProductsFile(event: any) {
  const functionName = 'importProductsFile';
  logRequest(functionName, event);
  
  // Debug: Log the entire event to see what's being received
  console.log('DEBUG: Full event object:', JSON.stringify(event, null, 2));
  
  try {
    const bucketName = process.env.IMPORT_BUCKET_NAME;
    
    if (!bucketName) {
      return createErrorResponse(500, 'Server configuration error', 'Import bucket name not configured');
    }

    // Extract fileName from query string parameters
    const fileName = event.queryStringParameters?.name || event.queryStringParameters?.fileName || event.fileName || event.name;
    
    if (!fileName) {
      return createErrorResponse(400, 'Validation failed', 'fileName query parameter is required');
    }

    // Validate fileName
    const validationErrors: string[] = [];
    
    if (typeof fileName !== 'string') {
      validationErrors.push('fileName must be a string');
    } else if (fileName.trim().length === 0) {
      validationErrors.push('fileName cannot be empty');
    } else if (!fileName.toLowerCase().endsWith('.csv')) {
      validationErrors.push('fileName must end with .csv');
    } else if (fileName.length > 255) {
      validationErrors.push('fileName must be less than 255 characters');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      validationErrors.push('fileName can only contain alphanumeric characters, dots, hyphens, and underscores');
    }
    
    if (validationErrors.length > 0) {
      return createErrorResponse(400, 'Validation failed', validationErrors);
    }

    // Create the S3 key with uploaded/ prefix
    const s3Key = `uploaded/${fileName}`;

    // Create a PutObjectCommand for the signed URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: 'text/csv',
    });

    // Generate signed URL with 5 minutes expiration
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    logRequest(functionName, event, { 
      fileName,
      s3Key,
      success: true 
    });
    
    return createSuccessResponse({
      signedUrl,
      fileName,
      s3Key,
      expiresIn: 300 // 5 minutes
    });
  } catch (error: any) {
    logError(functionName, error, event);
    
    // Handle specific error types
    if (error.name === 'ValidationException') {
      return createErrorResponse(400, 'Invalid input', error.message);
    }
    
    if (error.name === 'AccessDeniedException') {
      return createErrorResponse(500, 'Server configuration error', 'S3 access denied');
    }
    
    // Generic server error
    return createErrorResponse(500, 'Internal server error', 'An unexpected error occurred while generating signed URL');
  }
}

export async function importFileParser(event: any) {
  const functionName = 'importFileParser';
  logRequest(functionName, event);
  
  try {
    // Extract S3 event information
    const s3Record = event.Records?.[0]?.s3;
    
    if (!s3Record) {
      console.error('No S3 record found in event');
      return;
    }

    const bucketName = s3Record.bucket.name;
    const objectKey = decodeURIComponent(s3Record.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing S3 event: bucket=${bucketName}, key=${objectKey}`);
    
    // Only process files in the uploaded folder
    if (!objectKey.startsWith('uploaded/')) {
      console.log(`Skipping file ${objectKey} - not in uploaded folder`);
      return;
    }

    // Only process CSV files
    if (!objectKey.toLowerCase().endsWith('.csv')) {
      console.log(`Skipping file ${objectKey} - not a CSV file`);
      return;
    }

    // Get the CSV file from S3
    const getObjectParams = {
      Bucket: bucketName,
      Key: objectKey
    };

    const getObjectResponse = await s3Client.send(new GetObjectCommand(getObjectParams));
    
    // Create a readable stream from the S3 object
    const s3Stream = getObjectResponse.Body as Readable;
    
    let recordCount = 0;
    const records: any[] = [];
    
    // Parse CSV using csv-parser and send records to SQS
    await new Promise((resolve, reject) => {
      s3Stream
        .pipe(csv())
        .on('data', async (record) => {
          recordCount++;
          records.push(record);
          
          try {
            // Send record to SQS queue
            const sqsMessage = {
              title: record.title || record.Title || '',
              description: record.description || record.Description || '',
              price: parseFloat(record.price || record.Price || '0'),
              count: parseInt(record.count || record.Count || '0'),
              artist: record.artist || record.Artist || undefined,
              category: record.category || record.Category || undefined,
              genre: record.genre || record.Genre || undefined,
              year: record.year ? parseInt(record.year) : undefined,
              imageUrl: record.imageUrl || record.ImageUrl || record.image_url || undefined
            };

            const sendMessageParams = {
              QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL,
              MessageBody: JSON.stringify(sqsMessage)
            };

            await sqsClient.send(new SendMessageCommand(sendMessageParams));
            console.log(`Sent record ${recordCount} to SQS queue`);
          } catch (sqsError: any) {
            console.error(`Failed to send record ${recordCount} to SQS:`, sqsError.message);
          }
        })
        .on('end', () => {
          console.log(`CSV parsing completed for ${objectKey}`);
          console.log(`Total records processed: ${recordCount}`);
          
          logRequest(functionName, event, { 
            bucketName,
            objectKey,
            recordCount,
            success: true 
          });
          
          resolve(records);
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        });
    });

    console.log(`Successfully processed ${recordCount} records from ${objectKey}`);

    // Move file from uploaded/ to parsed/ folder
    const fileName = objectKey.replace('uploaded/', '');
    const parsedKey = `parsed/${fileName}`;
    
    console.log(`Moving file from ${objectKey} to ${parsedKey}`);
    
    // Copy file to parsed folder
    const copyParams = {
      Bucket: bucketName,
      CopySource: `${bucketName}/${objectKey}`,
      Key: parsedKey
    };
    
    await s3Client.send(new CopyObjectCommand(copyParams));
    console.log(`Successfully copied file to ${parsedKey}`);
    
    // Delete original file from uploaded folder
    const deleteParams = {
      Bucket: bucketName,
      Key: objectKey
    };
    
    await s3Client.send(new DeleteObjectCommand(deleteParams));
    console.log(`Successfully deleted original file from ${objectKey}`);
    
    logRequest(functionName, event, { 
      bucketName,
      originalKey: objectKey,
      parsedKey,
      recordCount,
      fileMoved: true,
      success: true 
    });

  } catch (error: any) {
    logError(functionName, error, event);
    
    // Log error details but don't fail the Lambda (S3 events should be idempotent)
    console.error('Error processing S3 event:', error);
    
    // Don't throw error to prevent S3 event retry failures
    // The error is already logged in CloudWatch for debugging
  }
}
