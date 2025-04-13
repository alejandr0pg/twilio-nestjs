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

# ----> AÑADIR ESTA LÍNEA PARA VERIFICAR <----
RUN echo "Contenido de /app/dist después del build:" && ls -la /app/dist
# ----> FIN DE LA LÍNEA AÑADIDA <----

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

EXPOSE 3000
CMD ["node", "dist/main"]
