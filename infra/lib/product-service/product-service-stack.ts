// Filename: product-service-stack.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the getProductsList Lambda function
    const getProductsListFunction = new lambda.Function(this, 'getProductsList', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      environment: {
        NODE_ENV: 'production'
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
        NODE_ENV: 'production'
      }
    });

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

    // Add CORS preflight for /products
    productsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
    });

    // Create /products/{productId} resource
    const productByIdResource = productsResource.addResource("{productId}");

    // Create Lambda integration for getProductById
    const getProductByIdIntegration = new apigateway.LambdaIntegration(getProductByIdFunction, {
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
