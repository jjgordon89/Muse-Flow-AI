/**
 * Secure storage service for encrypting sensitive data like API keys
 * Uses Web Crypto API for encryption/decryption
 */

interface SecureStorageOptions {
  keyName?: string;
  algorithm?: string;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

export class SecureStorage {
  private static readonly DEFAULT_ALGORITHM = 'AES-GCM';
  private static readonly DEFAULT_KEY_NAME = 'ai-writer-key';
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;

  private keyName: string;
  private algorithm: string;
  private cryptoKey: CryptoKey | null = null;

  constructor(options: SecureStorageOptions = {}) {
    this.keyName = options.keyName || SecureStorage.DEFAULT_KEY_NAME;
    this.algorithm = options.algorithm || SecureStorage.DEFAULT_ALGORITHM;
  }

  /**
   * Initialize the encryption key
   */
  async initialize(userPassword?: string): Promise<void> {
    try {
      // Generate a key derivation password if not provided
      const password = userPassword || await this.getOrCreateMasterPassword();
      
      // Get or generate salt
      const salt = await this.getOrCreateSalt();
      
      // Derive key from password
      this.cryptoKey = await this.deriveKey(password, salt);
    } catch (error) {
      console.error('Failed to initialize secure storage:', error);
      throw new Error('Secure storage initialization failed');
    }
  }

  /**
   * Encrypt and store sensitive data
   */
  async setSecure(key: string, value: string): Promise<void> {
    if (!this.cryptoKey) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const encrypted = await this.encrypt(value);
      localStorage.setItem(this.getSecureKey(key), JSON.stringify(encrypted));
    } catch (error) {
      console.error('Failed to store encrypted data:', error);
      throw new Error('Failed to store secure data');
    }
  }

  /**
   * Retrieve and decrypt sensitive data
   */
  async getSecure(key: string): Promise<string | null> {
    if (!this.cryptoKey) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const stored = localStorage.getItem(this.getSecureKey(key));
      if (!stored) return null;

      const encryptedData: EncryptedData = JSON.parse(stored);
      return await this.decrypt(encryptedData);
    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error);
      return null;
    }
  }

  /**
   * Remove encrypted data
   */
  removeSecure(key: string): void {
    localStorage.removeItem(this.getSecureKey(key));
  }

  /**
   * Clear all secure storage
   */
  clearAll(): void {
    const keys = Object.keys(localStorage);
    const securePrefix = this.getSecureKey('');
    
    keys.forEach(key => {
      if (key.startsWith(securePrefix)) {
        localStorage.removeItem(key);
      }
    });
    
    // Also clear master password and salt
    localStorage.removeItem(`${this.keyName}-password`);
    localStorage.removeItem(`${this.keyName}-salt`);
  }

  /**
   * Check if secure storage is available
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           'crypto' in window && 
           'subtle' in window.crypto &&
           'localStorage' in window;
  }

  private async encrypt(text: string): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(SecureStorage.IV_LENGTH));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: this.algorithm, iv },
      this.cryptoKey!,
      data
    );
    
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      salt: '' // Salt is stored separately
    };
  }

  private async decrypt(encryptedData: EncryptedData): Promise<string> {
    const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: this.algorithm, iv },
      this.cryptoKey!,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    // Derive key using PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async getOrCreateMasterPassword(): Promise<string> {
    const stored = localStorage.getItem(`${this.keyName}-password`);
    if (stored) return stored;
    
    // Generate a random password
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const password = this.arrayBufferToBase64(array);
    
    localStorage.setItem(`${this.keyName}-password`, password);
    return password;
  }

  private async getOrCreateSalt(): Promise<Uint8Array> {
    const stored = localStorage.getItem(`${this.keyName}-salt`);
    if (stored) {
      return new Uint8Array(this.base64ToArrayBuffer(stored));
    }
    
    // Generate new salt
    const salt = crypto.getRandomValues(new Uint8Array(SecureStorage.SALT_LENGTH));
    localStorage.setItem(`${this.keyName}-salt`, this.arrayBufferToBase64(salt));
    return salt;
  }

  private getSecureKey(key: string): string {
    return `${this.keyName}-secure-${key}`;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = new Uint8Array(buffer);
    const base64 = btoa(String.fromCharCode(...binary));
    return base64;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}

// Singleton instance
export const secureStorage = new SecureStorage();