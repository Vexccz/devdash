import crypto from 'node:crypto';
import fs from 'node:fs';
import { loadConfig, configPath, saveConfig, type AppConfig } from './config';

/**
 * Export the entire app config to an encrypted JSON file.
 * Uses AES-256-GCM with a key derived from passphrase via scrypt.
 */
export function exportConfig(outPath: string, passphrase: string): { ok: boolean; error?: string } {
  try {
    const cfg = loadConfig();
    const plaintext = JSON.stringify(cfg);

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(passphrase, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const envelope = {
      version: 1,
      format: 'devdash-config-v1',
      createdAt: new Date().toISOString(),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };

    fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2), 'utf8');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Export failed' };
  }
}

/**
 * Import and decrypt a config file, replacing the current config.
 * Returns the merged config without writing to disk unless `apply` is true.
 */
export function importConfig(inPath: string, passphrase: string, apply: boolean): { ok: boolean; error?: string; config?: AppConfig } {
  try {
    const raw = fs.readFileSync(inPath, 'utf8');
    const envelope = JSON.parse(raw) as {
      version: number;
      format: string;
      salt: string;
      iv: string;
      tag: string;
      data: string;
    };

    if (envelope.format !== 'devdash-config-v1') {
      return { ok: false, error: `Unsupported format: ${envelope.format}` };
    }

    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const encrypted = Buffer.from(envelope.data, 'base64');
    const key = crypto.scryptSync(passphrase, salt, 32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted: Buffer;
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch {
      return { ok: false, error: 'Wrong passphrase or corrupted file' };
    }

    const cfg = JSON.parse(decrypted.toString('utf8')) as AppConfig;

    if (!cfg || !Array.isArray(cfg.projects) || !cfg.settings) {
      return { ok: false, error: 'Invalid config structure' };
    }

    if (apply) {
      saveConfig(cfg);
    }

    return { ok: true, config: cfg };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Import failed' };
  }
}
