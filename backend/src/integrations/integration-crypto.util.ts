import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { ConfigService } from '@nestjs/config';

function deriveKey(config: ConfigService): Buffer {
  const secret =
    config.get<string>('INTEGRATION_SECRET_KEY') ??
    config.get<string>('JWT_SECRET') ??
    'dev_integration_secret';
  return scryptSync(secret, 'clinica-integration-v1', 32);
}

export function encryptSecret(plain: string, config: ConfigService): string {
  const key = deriveKey(config);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(enc: string, config: ConfigService): string {
  const parts = enc.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Formato de secreto inválido');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const key = deriveKey(config);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
