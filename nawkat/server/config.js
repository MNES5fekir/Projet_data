import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Charge le fichier .env s'il existe (Node >= 21)
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT) || 3000;

export const config = {
  root,
  env,
  isProd: env === 'production',
  port,
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'nawkat.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  payment: {
    // 'simulation' (développement) ou 'paytech' (production : Wave, Orange Money, Free Money, cartes)
    provider: process.env.PAYMENT_PROVIDER || 'simulation',
    paytech: {
      apiKey: process.env.PAYTECH_API_KEY || '',
      apiSecret: process.env.PAYTECH_API_SECRET || '',
      env: process.env.PAYTECH_ENV || 'test',
    },
  },
  defaults: {
    registrationFee: Number(process.env.REGISTRATION_FEE) || 15000, // FCFA
    commissionRate: Number(process.env.COMMISSION_RATE) || 0.1,     // 10 %
    autoCompleteDays: 7,
  },
};

if (config.isProd) {
  if (config.jwtSecret === 'dev-only-secret-change-me' || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET doit être défini (32 caractères minimum) en production.');
  }
  if (config.payment.provider === 'simulation') {
    throw new Error('PAYMENT_PROVIDER=simulation est interdit en production.');
  }
}
