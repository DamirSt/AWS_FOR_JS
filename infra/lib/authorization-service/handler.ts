import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Error response helper
function createErrorResponse(statusCode: number, message: string, details?: any): APIGatewayProxyResult {
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
function createSuccessResponse(data: any): APIGatewayProxyResult {
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

// Decode Basic Auth token
function decodeBasicAuth(token: string): { username: string; password: string } | null {
  try {
    const base64Credentials = token.split(' ')[1];
    if (!base64Credentials) {
      return null;
    }
    
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (!username || !password) {
      return null;
    }
    
    return { username, password };
  } catch (error) {
    console.error('Error decoding Basic Auth token:', error);
    return null;
  }
}

// Generate IAM policy for API Gateway authorizer
function generatePolicy(principalId: string, effect: string, resource: string, context?: any) {
  const authResponse = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context: context || {}
  };
  
  return authResponse;
}

// Main handler function for API Gateway Lambda Authorizer
export const basicAuthorizer = async (event: any): Promise<any> => {
  logRequest('basicAuthorizer', event);
  
  // Check if Authorization header is provided
  const authHeader = event.headers?.Authorization || event.headers?.authorization || event.authorizationToken;
  
  if (!authHeader) {
    console.log('Authorization header is missing');
    return generatePolicy('user', 'Deny', event.methodArn, {
      error: 'Authorization header is required'
    });
  }
  
  // Check if it's Basic Auth
  if (!authHeader.startsWith('Basic ')) {
    console.log('Invalid authorization scheme. Expected Basic Auth');
    return generatePolicy('user', 'Deny', event.methodArn, {
      error: 'Invalid authorization scheme. Expected Basic Auth'
    });
  }
  
  // Decode the Basic Auth token
  const credentials = decodeBasicAuth(authHeader);
  
  if (!credentials) {
    console.log('Invalid authorization token format');
    return generatePolicy('user', 'Deny', event.methodArn, {
      error: 'Invalid authorization token format'
    });
  }
  
  // Get environment variables for user credentials
  const allowedUsers = process.env;
  
  // Check if user exists and password matches
  const expectedPassword = allowedUsers[credentials.username];
  
  if (!expectedPassword) {
    console.log(`User not found: ${credentials.username}`);
    return generatePolicy('user', 'Deny', event.methodArn, {
      error: 'Access denied: User not found'
    });
  }
  
  if (credentials.password !== expectedPassword) {
    console.log(`Invalid password for user: ${credentials.username}`);
    return generatePolicy('user', 'Deny', event.methodArn, {
      error: 'Access denied: Invalid password'
    });
  }
  
  // Authentication successful
  console.log(`Authentication successful for user: ${credentials.username}`);
  return generatePolicy(credentials.username, 'Allow', event.methodArn, {
    user: credentials.username,
    timestamp: new Date().toISOString()
  });
};
