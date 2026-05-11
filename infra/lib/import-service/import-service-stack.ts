import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as s3EventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { loadEnvVariables } from './env-loader';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for import service
    const importBucket = new s3.Bucket(this, 'ImportBucket', {
      bucketName: 'import-service-bucket-' + cdk.Aws.ACCOUNT_ID,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY, // For development - change to RETAIN for production
      autoDeleteObjects: true, // For development - remove for production
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Load environment variables from .env file
    const authEnvVars = loadEnvVariables();

    // Create the basicAuthorizer Lambda function
    const basicAuthorizerFunction = new lambda.Function(this, 'basicAuthorizer', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler.basicAuthorizer',
      code: lambda.Code.fromAsset(path.join(__dirname, '../authorization-service')),
      environment: authEnvVars
    });

    // Create the importProductsFile Lambda function
    const importProductsFileFunction = new lambda.Function(this, 'importProductsFile', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler.importProductsFile',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
        NODE_ENV: 'production'
      }
    });

    // Grant the Lambda function permissions to interact with S3
    importBucket.grantPut(importProductsFileFunction);
    importBucket.grantRead(importProductsFileFunction);

    // Get reference to the catalogItemsQueue from ProductServiceStack
    const catalogItemsQueue = sqs.Queue.fromQueueArn(this, 'CatalogItemsQueue', 
      `arn:aws:sqs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:catalogItemsQueue`);

    // Create the importFileParser Lambda function
    const importFileParserFunction = new lambda.Function(this, 'importFileParser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30), // Increased timeout for CSV processing
      handler: 'handler.importFileParser',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
        NODE_ENV: 'production'
      }
    });

    // Grant the importFileParser Lambda function permissions to interact with S3
    importBucket.grantRead(importFileParserFunction);
    importBucket.grantPut(importFileParserFunction); // For copying files to parsed folder
    importBucket.grantDelete(importFileParserFunction); // For deleting files from uploaded folder

    // Grant the importFileParser Lambda function permissions to send messages to SQS
    catalogItemsQueue.grantSendMessages(importFileParserFunction);

    // Add S3 event trigger for the importFileParser function
    // Only trigger for objects created in the uploaded folder
    importFileParserFunction.addEventSource(new s3EventSources.S3EventSource(importBucket, {
      events: [s3.EventType.OBJECT_CREATED],
      filters: [
        { prefix: 'uploaded/' } // Only trigger for objects in the uploaded folder
      ]
    }));

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service API',
      description: 'API for importing product files',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
      }
    });

    // Create Lambda authorizer
    const authorizer = new apigateway.TokenAuthorizer(this, 'BasicAuthorizer', {
      authorizerName: 'basicAuthorizer',
      identitySource: apigateway.IdentitySource.header('Authorization'),
      handler: basicAuthorizerFunction,
      resultsCacheTtl: cdk.Duration.seconds(0) // Disable caching for testing
    });

    // Create /import resource
    const importResource = api.root.addResource('import');

    // Create Lambda integration for importProductsFile
    const importProductsFileIntegration = new apigateway.LambdaIntegration(importProductsFileFunction, {
      requestTemplates: {
        "application/json": `{
          "fileName": "$input.params('fileName')"
        }`,
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'"
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      ],
      proxy: false,
    });

    // Add GET method to /import endpoint with authorizer
    importResource.addMethod('GET', importProductsFileIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '403',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // Output the bucket name and ARN for reference
    new cdk.CfnOutput(this, 'ImportBucketName', {
      value: importBucket.bucketName,
      description: 'The name of the import S3 bucket',
    });

    new cdk.CfnOutput(this, 'ImportBucketArn', {
      value: importBucket.bucketArn,
      description: 'The ARN of the import S3 bucket',
    });

    new cdk.CfnOutput(this, 'ImportApiUrl', {
      value: api.url,
      description: 'The URL of the Import API',
    });

    new cdk.CfnOutput(this, 'ImportEndpointUrl', {
      value: api.url + '/import',
      description: 'The URL of the import endpoint',
    });
  }
}
