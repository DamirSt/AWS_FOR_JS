import * as fs from 'fs';
import * as path from 'path';

export function loadEnvVariables(): Record<string, string> {
  const envPath = path.join(__dirname, '../authorization-service/.env');
  const envVars: Record<string, string> = {};
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    console.log('Loaded environment variables:', envVars);
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
  
  return envVars;
}
