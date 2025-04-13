import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CLIENT_ID = 'default-client-app';

async function main() {
  console.log('Seeding database...');

  // Verificar si ya existe un cliente por defecto
  const existingClient = await prisma.client.findFirst({
    where: { clientId: CLIENT_ID },
  });

  if (existingClient) {
    console.log('Default client already exists, generating token...');
    await generateTokenForClient(existingClient);
    return;
  }

  // Generar una API key aleatoria
  const apiKey = crypto.randomBytes(32).toString('hex');

  // Crear cliente por defecto en la base de datos
  const client = await prisma.client.create({
    data: {
      clientId: CLIENT_ID,
      name: 'Client Default Application',
      appVersion: '1.0.0',
      apiKey,
    },
  });

  console.log(`Default client created with ID: ${client.id}`);

  await generateTokenForClient(client);
}

async function generateTokenForClient(client: any) {
  // Crear un payload para el cliente
  const payload = {
    clientId: client.clientId,
    appVersion: client.appVersion,
  };

  // Generar un token simple (en producción usarías JWT)
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');

  // Guardar el token en un archivo para fácil acceso
  const tokenDir = path.join(process.cwd(), 'tokens');
  const tokenFile = path.join(tokenDir, 'default-token.txt');

  // Crear directorio si no existe
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
  }

  // Escribir token y API key en el archivo
  fs.writeFileSync(
    tokenFile,
    `Token: ${tokenData}\nAPI Key: ${client.apiKey}\n\nPara usar en Authorization header: Bearer ${tokenData}`,
  );

  console.log(
    `Token generated for client ${client.clientId} and saved to ${tokenFile}`,
  );
  console.log(`API Key: ${client.apiKey}`);

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
