/**
 * Enhanced secure storage with improved security model
 * Addresses the API key storage vulnerability by using session-based encryption
 */

interface SecureStorageOptions {
  keyName?: string;
  algorithm?: string;
  sessionTimeout?: number;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  timestamp: number;
}

interface SecurityContext {
  sessionKey: CryptoKey;
  createdAt: number;
  expiresAt: number;
}

export class EnhancedSecureStorage {
  private static readonly DEFAULT_ALGORITHM = 'AES-GCM';
  private static readonly DEFAULT_KEY_NAME = 'ai-writer-secure';
  private static readonly IV_LENGTH = 12;
  private static readonly SESSION_TIMEOUT = 3600000; // 1 hour
  private static readonly MAX_RETRIES = 3;

  private keyName: string;
  private algorithm: string;
  private sessionTimeout: number;
  private securityContext: SecurityContext | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(options: SecureStorageOptions = {}) {
    this.keyName = options.keyName || EnhancedSecureStorage.DEFAULT_KEY_NAME;
    this.algorithm = options.algorithm || EnhancedSecureStorage.DEFAULT_ALGORITHM;
    this.sessionTimeout = options.sessionTimeout || EnhancedSecureStorage.SESSION_TIMEOUT;
  }

  /**
   * Initialize with session-based encryption key
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeInternal();
    return this.initializationPromise;
  }

  private async initializeInternal(): Promise<void> {
    try {
      // Check if we have a valid session
      if (this.securityContext && this.isSessionValid()) {
        return;
      }

      // Generate new session key using Web Crypto API
      const sessionKey = await crypto.subtle.generateKey(
        { name: this.algorithm, length: 256 },
        false, // Not extractable for security
        ['encrypt', 'decrypt']
      );

      const now = Date.now();
      this.securityContext = {
        sessionKey,
        createdAt: now,
        expiresAt: now + this.sessionTimeout
      };

      // Clear any expired data
      this.cleanupExpiredData();

    } catch (error) {
      console.error('Failed to initialize enhanced secure storage:', error);
      throw new Error('Secure storage initialization failed');
    }
  }

  /**
   * Store encrypted data with session-based encryption
   */
  async setSecure(key: string, value: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.securityContext || !this.isSessionValid()) {
      throw new Error('Security context expired. Please reinitialize.');
    }

    const sanitizedKey = this.sanitizeKey(key);
    const sanitizedValue = this.sanitizeValue(value);

    try {
      const encrypted = await this.encrypt(sanitizedValue);
      const storageKey = this.getStorageKey(sanitizedKey);
      
      // Store with timestamp for expiration tracking
      const dataWithMetadata = {
        ...encrypted,
        timestamp: Date.now(),
        expiresAt: this.securityContext.expiresAt
      };

      sessionStorage.setItem(storageKey, JSON.stringify(dataWithMetadata));
    } catch (error) {
      console.error('Failed to store encrypted data:', error);
      throw new Error('Failed to store secure data');
    }
  }

  /**
   * Retrieve and decrypt data
   */
  async getSecure(key: string): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.securityContext || !this.isSessionValid()) {
      return null; // Session expired, return null instead of throwing
    }

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const storageKey = this.getStorageKey(sanitizedKey);
      const stored = sessionStorage.getItem(storageKey);
      
      if (!stored) return null;

      const encryptedData: EncryptedData = JSON.parse(stored);
      
      // Check if data is expired
      if (Date.now() > encryptedData.timestamp + this.sessionTimeout) {
        this.removeSecure(key);
        return null;
      }

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
    const sanitizedKey = this.sanitizeKey(key);
    const storageKey = this.getStorageKey(sanitizedKey);
    sessionStorage.removeItem(storageKey);
  }

  /**
   * Clear all secure data and reset session
   */
  clearAll(): void {
    try {
      // Clear all items with our prefix
      const keys = Object.keys(sessionStorage);
      const prefix = this.getStorageKey('');
      
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
        }
      });

      // Reset security context
      this.securityContext = null;
      this.initializationPromise = null;
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }
  }

  /**
   * Check if secure storage is available and functional
   */
  static async isAvailable(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || 
          !('crypto' in window) || 
          !('subtle' in window.crypto) ||
          !('sessionStorage' in window)) {
        return false;
      }

      // Test crypto functionality
      const testKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // Test session storage
      const testValue = 'test';
      sessionStorage.setItem('test-key', testValue);
      const retrieved = sessionStorage.getItem('test-key');
      sessionStorage.removeItem('test-key');

      return retrieved === testValue;
    } catch {
      return false;
    }
  }

  /**
   * Get session status information
   */
  getSessionInfo(): { isValid: boolean; expiresIn: number; createdAt: number } | null {
    if (!this.securityContext) {
      return null;
    }

    const now = Date.now();
    return {
      isValid: this.isSessionValid(),
      expiresIn: Math.max(0, this.securityContext.expiresAt - now),
      createdAt: this.securityContext.createdAt
    };
  }

  private async encrypt(text: string): Promise<EncryptedData> {
    if (!this.securityContext) {
      throw new Error('Security context not initialized');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(EnhancedSecureStorage.IV_LENGTH));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.algorithm, iv },
      this.securityContext.sessionKey,
      data
    );
    
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      timestamp: Date.now()
    };
  }

  private async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.securityContext) {
      throw new Error('Security context not initialized');
    }

    const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: this.algorithm, iv },
      this.securityContext.sessionKey,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  private isSessionValid(): boolean {
    if (!this.securityContext) return false;
    return Date.now() < this.securityContext.expiresAt;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.securityContext || !this.isSessionValid()) {
      await this.initialize();
    }
  }

  private cleanupExpiredData(): void {
    try {
      const keys = Object.keys(sessionStorage);
      const prefix = this.getStorageKey('');
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          try {
            const stored = sessionStorage.getItem(key);
            if (stored) {
              const data = JSON.parse(stored);
              if (data.expiresAt && now > data.expiresAt) {
                sessionStorage.removeItem(key);
              }
            }
          } catch {
            // Remove corrupted data
            sessionStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }

  private sanitizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key provided');
    }
    return key.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 100);
  }

  private sanitizeValue(value: string): string {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    if (value.length > 100000) { // 100KB limit
      throw new Error('Value too large for secure storage');
    }
    return value;
  }

  private getStorageKey(key: string): string {
    return `${this.keyName}-${key}`;
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

// Singleton instance with enhanced security
export const enhancedSecureStorage = new EnhancedSecureStorage();