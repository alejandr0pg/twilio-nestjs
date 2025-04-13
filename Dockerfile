# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar archivos de definición de dependencias
COPY package.json yarn.lock ./

# Instalar todas las dependencias (incluyendo devDependencies para build)
RUN yarn install --frozen-lockfile

# Copiar archivos necesarios para la compilación y Prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma/
COPY src ./src/

# Generar Prisma Client (requiere schema.prisma)
RUN yarn prisma generate

# Construir la aplicación (compilar TypeScript a JavaScript en ./dist)
RUN yarn build

# Opcional: Eliminar devDependencies para reducir tamaño de node_modules si se copian
# RUN yarn install --production --ignore-scripts --prefer-offline

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

# Copiar dependencias de producción desde el builder
# Asegúrate de copiar node_modules ANTES de package.json si usaste la opción de eliminar devDependencies arriba
# Si no eliminaste devDependencies, este orden está bien.
COPY --from=builder /app/node_modules ./node_modules

# Copiar artefactos de build (la carpeta dist)
COPY --from=builder /app/dist ./dist

# Copiar package.json (necesario por Node/frameworks) y Prisma schema (por si acaso)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# Exponer el puerto que usa la aplicación (ajústalo si es diferente)
EXPOSE 3000

# Comando para iniciar la aplicación en producción
CMD ["node", "dist/main"]
