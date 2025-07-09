# INSTRUCCIONES DE RECUPERACIÓN DE EMERGENCIA - KEYLESS BACKUP

## 🚨 PROBLEMA CRÍTICO IDENTIFICADO

Se han identificado problemas graves en el sistema de backup keyless que impiden a los usuarios recuperar sus wallets. **Al menos 5 usuarios críticos** no pueden acceder a sus fondos.

## 📊 USUARIOS AFECTADOS CONFIRMADOS

1. **+573045485265** → Wallet: `0xb99842f945e804fa424ce30c7622a30c1ac77969` (6 intentos fallidos)
2. **+573052151556** → Wallet: `0x00a8f2b2ab7f4b6e8a5f4c3d2e1f0a9b8c7d6e5f` (6 intentos fallidos)  
3. **+573205861274** → Wallet: `0x5ca973def6fe183964a8e6c4949913aef6c6ada5` (6 intentos fallidos)
4. **+573334307212** → Wallet: `0xf5b6e35a092868263749fc57f6976e55347132d6` (5 intentos fallidos)
5. **+573127785989** → Wallet: `0x74c099d9398c30b43644b691edb427ffcf94f6c1` (5 intentos fallidos)

## 🔧 SOLUCIÓN IMPLEMENTADA

### 1. Script de Reparación SQL
- **Archivo**: `emergency-recovery.sql`
- **Función**: Repara keyshares inconsistentes en la base de datos
- **Estado**: ✅ Listo para ejecutar

### 2. Endpoint de Recuperación Manual
- **Endpoint**: `POST /otp/emergency-recovery`
- **Función**: Permite recuperación administrativa con código especial
- **Estado**: ✅ Implementado

### 3. Corrección del Bug de Keyshare
- **Archivo**: `src/otp/otp.service.ts`
- **Función**: Corrige la lógica de reutilización de keyshares
- **Estado**: ✅ Implementado

## 📋 PASOS PARA EJECUTAR LA RECUPERACIÓN

### PASO 1: Ejecutar Script SQL de Reparación
```bash
# Conectar a la base de datos
psql "postgresql://postgres:vWmfOhsZhlICArixYqONLKicxKIRnTcr@metro.proxy.rlwy.net:18857/railway"

# Ejecutar el script de reparación
\i emergency-recovery.sql
```

### PASO 2: Configurar Variables de Entorno
```bash
# Agregar al archivo .env
EMERGENCY_RECOVERY_CODE=TuCop2025EmergencyRecovery!
```

### PASO 3: Reiniciar el Servicio Backend
```bash
# Reiniciar el servicio otp-twilio
pm2 restart otp-twilio
# o
docker restart otp-twilio-container
```

### PASO 4: Usar el Endpoint de Recuperación Manual
Para cada usuario afectado, hacer una petición POST:

```bash
curl -X POST http://localhost:3000/otp/emergency-recovery \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "phone": "+573045485265",
    "walletAddress": "0xb99842f945e804fa424ce30c7622a30c1ac77969",
    "adminCode": "TuCop2025EmergencyRecovery!"
  }'
```

### PASO 5: Verificar la Recuperación
```bash
# Verificar que los usuarios pueden ahora recuperar sus wallets
curl -X POST http://localhost:3000/otp/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "phone": "+573045485265",
    "code": "999999"
  }'
```

## 🛠️ PREVENCIÓN FUTURA

### Cambios Implementados:
1. **Keyshare Consistency**: Ahora reutiliza keyshares existentes correctamente
2. **Emergency Recovery**: Endpoint administrativo para casos críticos
3. **Extended Expiration**: OTPs de emergencia válidos por 24 horas
4. **Better Error Handling**: Manejo mejorado de errores en el flujo de recuperación

### Monitoreo Recomendado:
- Alertas cuando un usuario tenga más de 3 intentos de OTP fallidos
- Logging detallado de todas las operaciones de keyshare
- Dashboard para monitorear el estado de backups por usuario

## 🚨 ACCIONES INMEDIATAS REQUERIDAS

1. **EJECUTAR SCRIPT SQL** → Reparar registros existentes
2. **CONFIGURAR VARIABLES** → Habilitar recuperación de emergencia  
3. **REINICIAR SERVICIO** → Aplicar cambios en el código
4. **CONTACTAR USUARIOS** → Notificar sobre recuperación disponible
5. **MONITOREAR RESULTADOS** → Confirmar que la recuperación funciona

## 📞 CONTACTO DE EMERGENCIA

Si hay problemas durante la recuperación, contactar inmediatamente al equipo de desarrollo para soporte técnico.

---

**⚠️ IMPORTANTE**: Este es un problema crítico que afecta la capacidad de los usuarios para acceder a sus fondos. La recuperación debe ejecutarse lo antes posible.