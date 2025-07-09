-- SCRIPT DE RECUPERACIÓN DE EMERGENCIA PARA KEYLESS BACKUP
-- Este script corrige los problemas críticos identificados en el sistema de backup

-- 1. IDENTIFICAR USUARIOS CON PROBLEMAS DE KEYSHARE
WITH problematic_phones AS (
  SELECT 
    phone,
    COUNT(*) as otp_count,
    COUNT(DISTINCT keyshare) as unique_keyshares,
    COUNT(CASE WHEN keyshare IS NOT NULL THEN 1 END) as otps_with_keyshares,
    MIN(CASE WHEN keyshare IS NOT NULL THEN keyshare END) as first_keyshare,
    MAX("createdAt") as last_attempt
  FROM "OtpCode"
  GROUP BY phone
  HAVING COUNT(*) > 1 AND COUNT(DISTINCT keyshare) <= 1
)
SELECT 
  pp.phone,
  pp.otp_count,
  pp.unique_keyshares,
  pp.otps_with_keyshares,
  pp.first_keyshare,
  kb."walletAddress",
  kb.status
FROM problematic_phones pp
LEFT JOIN "KeylessBackup" kb ON pp.phone = kb.phone
ORDER BY pp.otp_count DESC;

-- 2. SCRIPT DE REPARACIÓN PARA USUARIOS ESPECÍFICOS
-- Reparar keyshares faltantes para usuarios críticos

-- Para +573045485265 (6 intentos, 1 keyshare válido)
UPDATE "OtpCode" 
SET keyshare = '4630e112ff4f06360a6b9e540f614f048e9b9ee389b1694ff588b1a999be6950'
WHERE phone = '+573045485265' 
  AND keyshare IS NULL 
  AND "createdAt" >= '2025-04-22 07:50:00';

-- Para +573052151556 (6 intentos, necesita keyshare consistente)
UPDATE "OtpCode" 
SET keyshare = '8642d1c5d489ffcb4ea1f4fa4b1c53e1e8b4889156e6a0a47208c3f3e7468631'
WHERE phone = '+573052151556' 
  AND keyshare IS NULL 
  AND "createdAt" >= '2025-06-01 20:00:00';

-- Para +573205861274 (6 intentos, 1 keyshare válido)
UPDATE "OtpCode" 
SET keyshare = '8eb086afdeffda1dd5d80e890f270a19a423e260a29843c57670aa1ef757b312'
WHERE phone = '+573205861274' 
  AND keyshare IS NULL 
  AND "createdAt" >= '2025-06-19 17:00:00';

-- 3. CREAR REGISTROS DE RECUPERACIÓN MANUAL
-- Permitir que estos usuarios recuperen sus wallets manualmente

-- Insertar OTPs de recuperación válidos con keyshares correctos
INSERT INTO "OtpCode" (phone, code, "isValid", "expiresAt", keyshare, "createdAt", "updatedAt")
VALUES 
  ('+573045485265', '999999', true, NOW() + INTERVAL '24 hours', '4630e112ff4f06360a6b9e540f614f048e9b9ee389b1694ff588b1a999be6950', NOW(), NOW()),
  ('+573052151556', '999999', true, NOW() + INTERVAL '24 hours', '8642d1c5d489ffcb4ea1f4fa4b1c53e1e8b4889156e6a0a47208c3f3e7468631', NOW(), NOW()),
  ('+573205861274', '999999', true, NOW() + INTERVAL '24 hours', '8eb086afdeffda1dd5d80e890f270a19a423e260a29843c57670aa1ef757b312', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4. ACTUALIZAR ESTADO DE BACKUPS A DISPONIBLE PARA RECUPERACIÓN
UPDATE "KeylessBackup" 
SET status = 'Recovery_Available', "updatedAt" = NOW()
WHERE phone IN ('+573045485265', '+573052151556', '+573205861274');

-- 5. LIMPIAR SESIONES EXPIRADAS PARA EVITAR CONFLICTOS
DELETE FROM "SiweSession" 
WHERE "expirationTime" < NOW() - INTERVAL '1 day';

-- 6. VERIFICACIÓN POST-REPARACIÓN
SELECT 
  kb.phone,
  kb."walletAddress",
  kb.status,
  COUNT(otp.id) as total_otps,
  COUNT(CASE WHEN otp.keyshare IS NOT NULL THEN 1 END) as otps_with_keyshares,
  COUNT(CASE WHEN otp."isValid" = true THEN 1 END) as valid_otps,
  MAX(CASE WHEN otp."isValid" = true THEN otp.keyshare END) as recovery_keyshare
FROM "KeylessBackup" kb
LEFT JOIN "OtpCode" otp ON kb.phone = otp.phone
WHERE kb.phone IN ('+573045485265', '+573052151556', '+573205861274')
GROUP BY kb.phone, kb."walletAddress", kb.status;