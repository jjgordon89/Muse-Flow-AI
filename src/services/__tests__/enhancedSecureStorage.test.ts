import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedSecureStorage } from '../enhancedSecureStorage';

// Mock crypto API
const mockCrypto = {
  subtle: {
    generateKey: vi.fn().mockResolvedValue({ type: 'secret' }),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
  },
  getRandomValues: vi.fn().mockReturnValue(new Uint8Array(12)),
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

describe('EnhancedSecureStorage', () => {
  let storage: EnhancedSecureStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new EnhancedSecureStorage();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await storage.initialize();
      
      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });

    it('should check availability', async () => {
      const available = await EnhancedSecureStorage.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('secure operations', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it('should store and retrieve encrypted data', async () => {
      const testKey = 'test-key';
      const testValue = 'test-value';

      // Mock successful encryption
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(new ArrayBuffer(32));
      
      await storage.setSecure(testKey, testValue);
      
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should retrieve and decrypt data', async () => {
      const testKey = 'test-key';
      const testValue = 'test-value';

      // Mock stored encrypted data
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify({
        encrypted: 'encrypted-data',
        iv: 'iv-data',
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000
      }));

      // Mock successful decryption
      const encoder = new TextEncoder();
      const decodedData = encoder.encode(testValue);
      mockCrypto.subtle.decrypt.mockResolvedValueOnce(decodedData.buffer);

      const result = await storage.getSecure(testKey);
      
      expect(mockSessionStorage.getItem).toHaveBeenCalled();
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
      expect(result).toBe(testValue);
    });

    it('should handle expired data', async () => {
      const testKey = 'test-key';

      // Mock expired data
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify({
        encrypted: 'encrypted-data',
        iv: 'iv-data',
        timestamp: Date.now() - 7200000, // 2 hours ago
        expiresAt: Date.now() - 3600000 // 1 hour ago (expired)
      }));

      const result = await storage.getSecure(testKey);
      expect(result).toBeNull();
    });

    it('should remove secure data', () => {
      const testKey = 'test-key';
      storage.removeSecure(testKey);
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it('should clear all data', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      Object.defineProperty(mockSessionStorage, 'length', { value: 0 });
      Object.keys = vi.fn().mockReturnValue([]);

      storage.clearAll();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors', async () => {
      await storage.initialize();
      
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));
      
      await expect(storage.setSecure('test-key', 'test-value')).rejects.toThrow('Failed to store secure data');
    });

    it('should handle decryption errors', async () => {
      await storage.initialize();
      
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify({
        encrypted: 'encrypted-data',
        iv: 'iv-data',
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000
      }));

      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));
      
      const result = await storage.getSecure('test-key');
      expect(result).toBeNull();
    });

    it('should handle invalid stored data', async () => {
      await storage.initialize();
      
      mockSessionStorage.getItem.mockReturnValueOnce('invalid-json');
      
      const result = await storage.getSecure('test-key');
      expect(result).toBeNull();
    });
  });

  describe('session management', () => {
    it('should provide session info', async () => {
      await storage.initialize();
      
      const sessionInfo = storage.getSessionInfo();
      expect(sessionInfo).toBeTruthy();
      expect(sessionInfo?.isValid).toBe(true);
      expect(sessionInfo?.expiresIn).toBeGreaterThan(0);
    });

    it('should handle session expiration', async () => {
      // Create storage with very short timeout
      const shortTimeoutStorage = new EnhancedSecureStorage({ sessionTimeout: 1 });
      await shortTimeoutStorage.initialize();
      
      // Wait for session to expire
      await new Promise(resolve => setTimeout(resolve, 2));
      
      const sessionInfo = shortTimeoutStorage.getSessionInfo();
      expect(sessionInfo?.isValid).toBe(false);
    });
  });
});