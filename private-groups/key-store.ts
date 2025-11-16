/**
 * Simple file-based key store for group encryption keys
 * In production, this would be a secure database or HSM
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_KEY_FILE = '.group-keys.json';

interface KeyStore {
  [groupUri: string]: string; // groupUri -> base64 encryption key
}

export class FileKeyStore {
  private keyFile: string;
  private keys: KeyStore;

  constructor(keyFile?: string) {
    this.keyFile = keyFile || path.join(process.cwd(), DEFAULT_KEY_FILE);
    this.keys = this.loadKeys();
  }

  private loadKeys(): KeyStore {
    try {
      if (fs.existsSync(this.keyFile)) {
        const data = fs.readFileSync(this.keyFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load key store:', error);
    }
    return {};
  }

  private saveKeys(): void {
    try {
      fs.writeFileSync(this.keyFile, JSON.stringify(this.keys, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save key store:', error);
      throw error;
    }
  }

  /**
   * Store an encryption key for a group
   */
  setKey(groupUri: string, key: string): void {
    this.keys[groupUri] = key;
    this.saveKeys();
  }

  /**
   * Get an encryption key for a group
   */
  getKey(groupUri: string): string | undefined {
    return this.keys[groupUri];
  }

  /**
   * Check if a key exists for a group
   */
  hasKey(groupUri: string): boolean {
    return groupUri in this.keys;
  }

  /**
   * Delete a key for a group
   */
  deleteKey(groupUri: string): void {
    delete this.keys[groupUri];
    this.saveKeys();
  }

  /**
   * List all group URIs with stored keys
   */
  listGroups(): string[] {
    return Object.keys(this.keys);
  }
}
