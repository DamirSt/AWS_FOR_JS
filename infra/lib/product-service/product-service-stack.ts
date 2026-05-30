// Filename: product-service-stack.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables (like TodoStack)
    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'products',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY // For development - remove in production
    });

    const stockTable = new dynamodb.Table(this, 'StockTable', {
      tableName: 'stock',
      partitionKey: {
        name: 'product_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY // For development - remove in production
    });

    // Create the getProductsList Lambda function
    const getProductsListFunction = new lambda.Function(this, 'getProductsList', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        NODE_ENV: 'production',
        PRODUCTS_TABLE: productsTable.tableName,
        STOCK_TABLE: stockTable.tableName
      }
    });

    // Create the getProductById Lambda function
    const getProductByIdFunction = new lambda.Function(this, 'getProductById', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler.getProductById',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        NODE_ENV: 'production',
        PRODUCTS_TABLE: productsTable.tableName,
        STOCK_TABLE: stockTable.tableName
      }
    });

    // Create the createProduct Lambda function
    const createProductFunction = new lambda.Function(this, 'createProduct', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler.createProduct',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        NODE_ENV: 'production',
        PRODUCTS_TABLE: productsTable.tableName,
        STOCK_TABLE: stockTable.tableName
      }
    });

    // Grant Lambda functions permissions to access DynamoDB tables
    productsTable.grantReadWriteData(getProductsListFunction);
    stockTable.grantReadWriteData(getProductsListFunction);
    productsTable.grantReadWriteData(getProductByIdFunction);
    stockTable.grantReadWriteData(getProductByIdFunction);
    productsTable.grantReadWriteData(createProductFunction);
    stockTable.grantReadWriteData(createProductFunction);

    // Create SQS queue for catalog items
    const catalogItemsQueue = new sqs.Queue(this, 'catalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30)
    });

    // Create catalogBatchProcess Lambda function
    const catalogBatchProcessFunction = new lambda.Function(this, 'catalogBatchProcess', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      handler: 'handler.catalogBatchProcess',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        NODE_ENV: 'production',
        PRODUCTS_TABLE: productsTable.tableName,
        STOCK_TABLE: stockTable.tableName
      }
    });

    // Grant catalogBatchProcess Lambda permissions to access DynamoDB tables
    productsTable.grantReadWriteData(catalogBatchProcessFunction);
    stockTable.grantReadWriteData(catalogBatchProcessFunction);

    // Configure SQS to trigger catalogBatchProcess Lambda with batch size 5
    catalogBatchProcessFunction.addEventSource(new SqsEventSource(catalogItemsQueue, {
      batchSize: 5
    }));

    // Create SNS topic for product creation notifications
    const createProductTopic = new sns.Topic(this, 'createProductTopic', {
      topicName: 'createProductTopic',
      displayName: 'Product Creation Notifications'
    });

    // Create email subscription for the SNS topic
    // Note: You'll need to confirm the subscription via email when AWS sends the confirmation
    const emailSubscription = new subscriptions.EmailSubscription('damirstanojevic@gmail.com');
    createProductTopic.addSubscription(emailSubscription);

    // Create additional email subscription for expensive products (price > 25)
    // Note: Filter policies would be configured manually in AWS Console or via CloudFormation
    const expensiveProductsSubscription = new subscriptions.EmailSubscription('damirstanojevic+expensive@gmail.com');
    createProductTopic.addSubscription(expensiveProductsSubscription);

    // Create additional email subscription for Rock genre products
    // Note: Filter policies would be configured manually in AWS Console or via CloudFormation
    const rockProductsSubscription = new subscriptions.EmailSubscription('damirstanojevic+rock@gmail.com');
    createProductTopic.addSubscription(rockProductsSubscription);

    // Grant catalogBatchProcess Lambda permission to publish to SNS topic
    createProductTopic.grantPublish(catalogBatchProcessFunction);

    // Add SNS topic ARN to environment variables for catalogBatchProcess
    catalogBatchProcessFunction.addEnvironment('CREATE_PRODUCT_TOPIC_ARN', createProductTopic.topicArn);

    // Create API Gateway for Product Service
    const productApi = new apigateway.RestApi(this, "product-api", {
      restApiName: "Product Service API",
      description: "API for Product Service operations"
    });

    // Create /products resource
    const productsResource = productApi.root.addResource("products");

    // Create Lambda integration for getProductsList
    const getProductsIntegration = new apigateway.LambdaIntegration(getProductsListFunction, {
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'"
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

    // Add GET method to /products endpoint
    productsResource.addMethod('GET', getProductsIntegration, {
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
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // Create Lambda integration for createProduct
    const createProductIntegration = new apigateway.LambdaIntegration(createProductFunction, {
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
          statusCode: '409',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        },
        {
          statusCode: '503',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      ],
      proxy: false,
    });

    // Add POST method to /products endpoint
    productsResource.addMethod('POST', createProductIntegration, {
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
          statusCode: '409',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '503',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // Add CORS preflight for /products
    productsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
    });

    // Create /products/{productId} resource
    const productByIdResource = productsResource.addResource("{productId}");

    // Create Lambda integration for getProductById
    const getProductByIdIntegration = new apigateway.LambdaIntegration(getProductByIdFunction, {
      requestTemplates: {
        "application/json": `{
          "productId": "$input.params('productId')"
        }`,
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'"
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        },
        {
          statusCode: '404',
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

    // Add GET method to /products/{productId} endpoint
    productByIdResource.addMethod('GET', getProductByIdIntegration, {
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
          statusCode: '404',
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

    // Add CORS preflight for /products/{productId}
    productByIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
    });

    // Output the API URL
    new cdk.CfnOutput(this, 'ProductApiUrl', {
      value: productApi.url ?? 'API URL not available',
      description: 'Product Service API Gateway URL',
      exportName: 'ProductApiUrl'
    });

    // Output the specific products endpoint URL
    new cdk.CfnOutput(this, 'ProductsEndpointUrl', {
      value: productApi.url + 'products',
      description: 'Products List Endpoint URL',
      exportName: 'ProductsEndpointUrl'
    });

    // Output the product by ID endpoint URL
    new cdk.CfnOutput(this, 'ProductByIdEndpointUrl', {
      value: productApi.url + 'products/{productId}',
      description: 'Product by ID Endpoint URL',
      exportName: 'ProductByIdEndpointUrl'
    });
  }
}
