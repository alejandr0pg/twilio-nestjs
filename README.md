<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# OTP Twilio - Servicio de Autenticación y Backup Keyless

Este proyecto es un servicio backend construido con NestJS que proporciona funcionalidades de autenticación OTP (One-Time Password) y backup keyless para wallets blockchain.

## Características Principales

- 🔐 Autenticación OTP vía SMS usando Twilio
- 💼 Backup keyless de wallets blockchain
- 🔑 Integración con SIWE (Sign-In with Ethereum)
- 🔒 Sistema de autenticación basado en API keys
- 📱 Soporte para múltiples clientes y versiones

## Estructura del Proyecto

```
src/
├── auth/           # Autenticación y autorización
├── otp/            # Gestión de códigos OTP
├── siwe/           # Integración con Sign-In with Ethereum
├── keyless-backup/ # Sistema de backup keyless
├── prisma/         # Configuración y modelos de base de datos
└── types/          # Definiciones de tipos TypeScript
```

## Modelos de Datos

### OtpCode

- Gestión de códigos OTP para verificación de teléfonos
- Incluye campos para keyshare y wallet

### SiweSession

- Manejo de sesiones de autenticación con Ethereum
- Almacena información de firma y mensajes

### KeylessBackup

- Sistema de backup keyless para wallets
- Almacena mnemónicos encriptados y direcciones asociadas

### Client

- Gestión de clientes y API keys
- Control de versiones y estado de activación

## Requisitos Previos

- Node.js (v16 o superior)
- PostgreSQL
- Cuenta de Twilio (para envío de SMS)

## Configuración

1. Clonar el repositorio

```bash
git clone [url-del-repositorio]
```

2. Instalar dependencias

```bash
yarn install
```

3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar el archivo `.env` con tus credenciales:

- DATABASE_URL
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER

4. Ejecutar migraciones de la base de datos

```bash
yarn prisma migrate dev
```

## Desarrollo

```bash
# Modo desarrollo
yarn start:dev

# Modo producción
yarn start:prod
```

## Testing

```bash
# Tests unitarios
yarn test

# Tests e2e
yarn test:e2e

# Cobertura de tests
yarn test:cov
```

## API Endpoints

### Autenticación

- POST /auth/verify-otp
- POST /auth/validate-api-key

### OTP

- POST /otp/send
- POST /otp/verify

### Keyless Backup

- POST /keyless-backup/initiate
- POST /keyless-backup/complete

### SIWE

- POST /siwe/verify
- GET /siwe/session/:id

## Seguridad

- Todas las comunicaciones deben usar HTTPS
- Las API keys deben ser rotadas periódicamente
- Los códigos OTP expiran después de un tiempo determinado
- Los mnemónicos se almacenan encriptados

## Contribución

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
