import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
export const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDir, '.env'), quiet: true });
export function configuration(overrides = {}) {
  const production = process.env.NODE_ENV === 'production';
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(serverDir, 'storage'));
  const config = {
    production, dataDir, databasePath: path.join(dataDir, 'building.sqlite'),
    uploadsDir: path.join(dataDir, 'uploads'), distDir: path.resolve(serverDir, '../dist'),
    origin: process.env.APP_ORIGIN || 'http://localhost:5173',
    port: Number(process.env.PORT || 5000), host: process.env.HOST || '0.0.0.0',
    trustProxy: process.env.TRUST_PROXY === '1' ? 1 : false,
    secureCookies: production, sessionMs: 7 * 86400000,
    registration: process.env.ALLOW_REGISTRATION !== 'false', maxFileBytes: 10 * 1024 * 1024,
    projectFileQuotaBytes: 500 * 1024 * 1024, minimumFreeBytes: 100 * 1024 * 1024,
    ...overrides,
  };
  const url = new URL(config.origin);
  if (config.origin !== url.origin) throw new Error('APP_ORIGIN must be an origin without a path or trailing slash.');
  if (config.production && url.protocol !== 'https:') throw new Error('Production APP_ORIGIN must use HTTPS.');
  return config;
}
