/**
 * Input validation and sanitization utilities
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * HTML and script injection prevention
 */
export class InputSanitizer {
  private static readonly DANGEROUS_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
    'meta', 'link', 'style', 'base', 'applet', 'body', 'html', 'head'
  ];

  private static readonly DANGEROUS_ATTRIBUTES = [
    'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur',
    'onchange', 'onsubmit', 'onreset', 'onkeydown', 'onkeyup', 'onkeypress',
    'onmousedown', 'onmouseup', 'onmousemove', 'onmouseout', 'onmouseenter',
    'onmouseleave', 'ondblclick', 'ondrag', 'ondrop', 'onscroll', 'onresize',
    'onhashchange', 'onpopstate', 'onpageshow', 'onpagehide', 'onbeforeunload',
    'onunload', 'javascript:', 'vbscript:', 'data:', 'mocha:', 'livescript:'
  ];

  /**
   * Sanitize HTML content - removes dangerous tags and attributes
   */
  static sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    let sanitized = input;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous tags
    this.DANGEROUS_TAGS.forEach(tag => {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?</${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
      
      // Also remove self-closing versions
      const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*/>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
    });

    // Remove dangerous attributes
    this.DANGEROUS_ATTRIBUTES.forEach(attr => {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    // Remove javascript: and other dangerous protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');

    return sanitized.trim();
  }

  /**
   * Sanitize plain text - encode HTML entities
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize user input for safe display
   */
  static sanitizeUserInput(input: string, allowBasicHtml = false): string {
    if (!input || typeof input !== 'string') return '';

    if (allowBasicHtml) {
      // Allow only safe HTML tags
      const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'i', 'b'];
      let sanitized = this.sanitizeHtml(input);
      
      // Remove all tags except allowed ones
      sanitized = sanitized.replace(/<(?!\/?(?:p|br|strong|em|u|i|b)\b)[^>]+>/gi, '');
      
      return sanitized;
    } else {
      return this.sanitizeText(input);
    }
  }

  /**
   * Validate and sanitize API keys
   */
  static sanitizeApiKey(apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') return '';

    // Remove any non-alphanumeric characters except dashes and underscores
    return apiKey.replace(/[^a-zA-Z0-9\-_]/g, '').trim();
  }

  /**
   * Validate URL inputs
   */
  static validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Sanitize file names
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') return '';

    return fileName
      .replace(/[^a-zA-Z0-9\-_.\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }
}

/**
 * Form validation utilities
 */
export class FormValidator {
  /**
   * Validate a single field
   */
  static validateField(value: any, rules: ValidationRule): string | null {
    // Required check
    if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return 'This field is required';
    }

    // Skip other validations if field is empty and not required
    if (!value && !rules.required) {
      return null;
    }

    const stringValue = String(value);

    // Length checks
    if (rules.minLength && stringValue.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    if (rules.maxLength && stringValue.length > rules.maxLength) {
      return `Must not exceed ${rules.maxLength} characters`;
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      return 'Invalid format';
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) return customError;
    }

    return null;
  }

  /**
   * Validate multiple fields
   */
  static validateForm(data: Record<string, any>, rules: Record<string, ValidationRule>): ValidationResult {
    const errors: Record<string, string> = {};

    Object.keys(rules).forEach(field => {
      const error = this.validateField(data[field], rules[field]);
      if (error) {
        errors[field] = error;
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Common validation rules
   */
  static rules = {
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      custom: (value: string) => {
        if (value && !this.rules.email.pattern!.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      }
    },

    apiKey: {
      minLength: 10,
      maxLength: 200,
      pattern: /^[a-zA-Z0-9\-_]+$/,
      custom: (value: string) => {
        if (value && value.includes(' ')) {
          return 'API key cannot contain spaces';
        }
        return null;
      }
    },

    url: {
      custom: (value: string) => {
        if (value && !InputSanitizer.validateUrl(value)) {
          return 'Please enter a valid URL (http or https)';
        }
        return null;
      }
    },

    projectTitle: {
      required: true,
      minLength: 1,
      maxLength: 100,
      custom: (value: string) => {
        if (value && /[<>:"/\\|?*]/.test(value)) {
          return 'Title cannot contain special characters: < > : " / \\ | ? *';
        }
        return null;
      }
    },

    characterName: {
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: /^[a-zA-Z\s\-'\.]+$/,
      custom: (value: string) => {
        if (value && !/^[a-zA-Z]/.test(value)) {
          return 'Name must start with a letter';
        }
        return null;
      }
    },

    description: {
      maxLength: 1000,
      custom: (value: string) => {
        if (value && value.trim().length > 0 && value.trim().length < 10) {
          return 'Description must be at least 10 characters if provided';
        }
        return null;
      }
    }
  };
}

/**
 * Content Security Policy helpers
 */
export class CSPHelper {
  /**
   * Generate CSP directives for the application
   */
  static generateCSP(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Allow inline scripts for React
      "style-src 'self' 'unsafe-inline'", // Allow inline styles for Tailwind
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com https://api.anthropic.com https://openrouter.ai https://api-inference.huggingface.co http://localhost:11434 http://localhost:1234",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ];

    return directives.join('; ');
  }

  /**
   * Set CSP headers (for server-side implementation)
   */
  static setCSPHeaders(response: any): void {
    const csp = this.generateCSP();
    response.setHeader('Content-Security-Policy', csp);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
}

/**
 * Rate limiting for API calls
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000 // 1 minute
  ) {}

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);

    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);

    return true;
  }

  /**
   * Get remaining attempts
   */
  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxAttempts - validAttempts.length);
  }

  /**
   * Clear attempts for a key
   */
  clearAttempts(key: string): void {
    this.attempts.delete(key);
  }
}