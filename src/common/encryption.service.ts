import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex) {
      this.logger.warn(
        'ENCRYPTION_KEY not set — sensitive tokens stored in plaintext.',
      );
      this.key = null;
      return;
    }
    if (hex.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(text: string): string {
    if (!this.key) return text;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(value: string): string {
    if (!this.key || !value.startsWith('enc:')) return value;
    const [, ivHex, encryptedHex] = value.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
