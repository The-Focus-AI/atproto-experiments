/**
 * Simple encryption utilities for private group messages
 * Uses AES-256-GCM for message encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Generate a new random encryption key for a group
 * Returns base64-encoded key
 */
export function generateGroupKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('base64');
}

/**
 * Encrypt a message with the group's shared key
 * @param plaintext - The message to encrypt
 * @param base64Key - The group's base64-encoded encryption key
 * @returns Encrypted message as base64 string with format: iv:authTag:ciphertext
 */
export function encryptMessage(plaintext: string, base64Key: string): string {
  const key = Buffer.from(base64Key, 'base64');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine iv:authTag:ciphertext all as base64
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a message with the group's shared key
 * @param encryptedData - Encrypted message in format: iv:authTag:ciphertext
 * @param base64Key - The group's base64-encoded encryption key
 * @returns Decrypted plaintext message
 */
export function decryptMessage(encryptedData: string, base64Key: string): string {
  try {
    const key = Buffer.from(base64Key, 'base64');
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate that a key is properly formatted
 */
export function isValidKey(base64Key: string): boolean {
  try {
    const key = Buffer.from(base64Key, 'base64');
    return key.length === KEY_LENGTH;
  } catch {
    return false;
  }
}
