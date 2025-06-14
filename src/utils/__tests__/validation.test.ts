import { describe, it, expect } from 'vitest';
import { InputSanitizer, FormValidator, RateLimiter } from '../validation';

describe('InputSanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should remove dangerous script tags', () => {
      const input = '<script>alert("xss")</script><p>Safe content</p>';
      const result = InputSanitizer.sanitizeHtml(input);
      expect(result).toBe('<p>Safe content</p>');
    });

    it('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(\'xss\')">Content</div>';
      const result = InputSanitizer.sanitizeHtml(input);
      expect(result).toBe('<div>Content</div>');
    });

    it('should handle empty input', () => {
      expect(InputSanitizer.sanitizeHtml('')).toBe('');
      expect(InputSanitizer.sanitizeHtml(null as any)).toBe('');
    });
  });

  describe('sanitizeText', () => {
    it('should encode HTML entities', () => {
      const input = '<script>alert("test")</script>';
      const result = InputSanitizer.sanitizeText(input);
      expect(result).toBe('<script>alert("test")</script>');
    });

    it('should handle special characters', () => {
      const input = '& < > " \' /';
      const result = InputSanitizer.sanitizeText(input);
      expect(result).toBe('& < > " \' /');
    });
  });

  describe('validateUrl', () => {
    it('should validate HTTP URLs', () => {
      expect(InputSanitizer.validateUrl('http://example.com')).toBe(true);
      expect(InputSanitizer.validateUrl('https://example.com')).toBe(true);
    });

    it('should reject non-HTTP URLs', () => {
      expect(InputSanitizer.validateUrl('ftp://example.com')).toBe(false);
      expect(InputSanitizer.validateUrl('javascript:alert(1)')).toBe(false);
    });

    it('should handle invalid URLs', () => {
      expect(InputSanitizer.validateUrl('not-a-url')).toBe(false);
      expect(InputSanitizer.validateUrl('')).toBe(false);
    });
  });
});

describe('FormValidator', () => {
  describe('validateField', () => {
    it('should validate required fields', () => {
      const rule = { required: true };
      expect(FormValidator.validateField('', rule)).toBe('This field is required');
      expect(FormValidator.validateField('value', rule)).toBeNull();
    });

    it('should validate length constraints', () => {
      const rule = { minLength: 3, maxLength: 10 };
      expect(FormValidator.validateField('ab', rule)).toBe('Must be at least 3 characters');
      expect(FormValidator.validateField('abcdefghijk', rule)).toBe('Must not exceed 10 characters');
      expect(FormValidator.validateField('abc', rule)).toBeNull();
    });

    it('should validate patterns', () => {
      const rule = { pattern: /^[a-z]+$/ };
      expect(FormValidator.validateField('ABC', rule)).toBe('Invalid format');
      expect(FormValidator.validateField('abc', rule)).toBeNull();
    });
  });

  describe('validateForm', () => {
    it('should validate multiple fields', () => {
      const data = { name: '', email: 'invalid-email' };
      const rules = {
        name: { required: true },
        email: FormValidator.rules.email
      };

      const result = FormValidator.validateForm(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('This field is required');
      expect(result.errors.email).toBe('Please enter a valid email address');
    });
  });
});

describe('RateLimiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter(5, 1000);
    
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('test')).toBe(true);
    }
    
    expect(limiter.isAllowed('test')).toBe(false);
  });

  it('should reset after time window', (done) => {
    const limiter = new RateLimiter(1, 50);
    
    expect(limiter.isAllowed('test')).toBe(true);
    expect(limiter.isAllowed('test')).toBe(false);
    
    setTimeout(() => {
      expect(limiter.isAllowed('test')).toBe(true);
      done();
    }, 60);
  });

  it('should track remaining attempts', () => {
    const limiter = new RateLimiter(3, 1000);
    
    expect(limiter.getRemainingAttempts('test')).toBe(3);
    limiter.isAllowed('test');
    expect(limiter.getRemainingAttempts('test')).toBe(2);
  });
});