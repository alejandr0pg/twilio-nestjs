import { PrismaClient, Client } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

const CLIENT_ID = 'default-client-app';
const JWT_SECRET_ENV = process.env.JWT_SECRET; // Get secret from environment variables
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h'; // Default expiration to 1 hour

async function main() {
  console.log('Seeding database...');

  if (!JWT_SECRET_ENV) { // Check the variable read from env
    console.error('Error: JWT_SECRET environment variable is not set.');
    console.error('Please define JWT_SECRET in your .env file or environment.');
    process.exit(1);
  }

  // Define the secret with the correct type *after* the check
  const jwtSecret: jwt.Secret = JWT_SECRET_ENV;

  // Check if default client exists
  let client = await prisma.client.findFirst({
    where: { clientId: CLIENT_ID },
  });

  if (client) {
    console.log('Default client already exists, generating token...');
    // Pass the correctly typed secret to the function
    await generateTokenForClient(client, jwtSecret);
    return;
  }

  // Generate a random API key
  const apiKey = crypto.randomBytes(32).toString('hex');

  // Create default client in the database
  client = await prisma.client.create({
    data: {
      clientId: CLIENT_ID,
      name: 'Client Default Application',
      appVersion: '1.0.0',
      apiKey,
    },
  });

  console.log(`Default client created with ID: ${client.id}`);

  // Pass the correctly typed secret to the function
  await generateTokenForClient(client, jwtSecret);
}

// Accept the secret as an argument with the correct type
async function generateTokenForClient(client: Client, secret: jwt.Secret) {
  // Payload for the JWT - explicitly typed
  const payload: jwt.JwtPayload = {
    sub: String(client.id), // Use client ID as subject
    clientId: client.clientId,
    appVersion: client.appVersion,
  };

  // Generate the JWT using the passed secret and options
  const tokenData = jwt.sign(payload, secret); // Pass explicit options

  // Save the token and API key to a file for easy access
  const tokenDir = path.join(process.cwd(), 'tokens');
  const tokenFile = path.join(tokenDir, 'default-token.txt');

  // Create directory if it doesn't exist
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
  }

  // Write token and API key to the file
  fs.writeFileSync(
    tokenFile,
    `Token: ${tokenData}
API Key: ${client.apiKey}

Para usar en Authorization header: Bearer ${tokenData}`,
  );

  console.log(
    `JWT generated for client ${client.clientId} and saved to ${tokenFile}`,
  );
  console.log(`API Key: ${client.apiKey}`);
  console.log(`Token expires in: ${JWT_EXPIRATION}`);


  return { token: tokenData, apiKey: client.apiKey };
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
