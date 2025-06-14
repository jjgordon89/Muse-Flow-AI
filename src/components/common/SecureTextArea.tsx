import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { FormValidator, ValidationRule, InputSanitizer } from '../../utils/validation';

interface SecureTextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  validationRules?: ValidationRule;
  className?: string;
  disabled?: boolean;
  showValidation?: boolean;
  rows?: number;
  allowBasicHtml?: boolean;
  maxLength?: number;
}

export function SecureTextArea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  validationRules,
  className = '',
  disabled = false,
  showValidation = true,
  rows = 4,
  allowBasicHtml = false,
  maxLength
}: SecureTextAreaProps) {
  const [isTouched, setIsTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(value.length);

  // Validate input
  useEffect(() => {
    if (showValidation && isTouched && validationRules) {
      const error = FormValidator.validateField(value, {
        required,
        maxLength,
        ...validationRules
      });
      setValidationError(error);
    }
    setCharCount(value.length);
  }, [value, validationRules, required, showValidation, isTouched, maxLength]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newValue = e.target.value;
    
    // Apply max length if specified
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.substring(0, maxLength);
    }
    
    // Sanitize input
    const sanitizedValue = InputSanitizer.sanitizeUserInput(newValue, allowBasicHtml);
    
    onChange(sanitizedValue);
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  const hasError = showValidation && isTouched && validationError;
  const isValid = showValidation && isTouched && !validationError && value.length > 0;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {maxLength && (
          <span className={`text-xs ${
            charCount > maxLength * 0.9 ? 'text-red-500' : 'text-gray-500'
          }`}>
            {charCount.toLocaleString()}{maxLength && `/${maxLength.toLocaleString()}`}
          </span>
        )}
      </div>
      
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors resize-vertical ${
            hasError
              ? 'border-red-300 focus:ring-red-500'
              : isValid
              ? 'border-green-300 focus:ring-green-500'
              : 'border-gray-300 focus:ring-indigo-500'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
        
        {/* Validation icon */}
        {showValidation && isTouched && (
          <div className="absolute right-2 top-2">
            {hasError ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : isValid ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : null}
          </div>
        )}
      </div>
      
      {/* Error message */}
      {hasError && (
        <p className="text-sm text-red-600 flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{validationError}</span>
        </p>
      )}
      
      {/* Help text */}
      {allowBasicHtml && !hasError && (
        <p className="text-xs text-gray-500">
          Basic HTML formatting is allowed (bold, italic, etc.)
        </p>
      )}
    </div>
  );
}