import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { FormValidator, ValidationRule } from '../../utils/validation';

interface SecureInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'email' | 'url';
  placeholder?: string;
  required?: boolean;
  validationRules?: ValidationRule;
  className?: string;
  disabled?: boolean;
  showValidation?: boolean;
  autoComplete?: string;
}

export function SecureInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  validationRules,
  className = '',
  disabled = false,
  showValidation = true,
  autoComplete = 'off'
}: SecureInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const inputType = type === 'password' && showPassword ? 'text' : type;
  const isPassword = type === 'password';

  // Validate input
  useEffect(() => {
    if (showValidation && isTouched && validationRules) {
      const error = FormValidator.validateField(value, {
        required,
        ...validationRules
      });
      setValidationError(error);
    }
  }, [value, validationRules, required, showValidation, isTouched]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Basic sanitization based on input type
    let sanitizedValue = newValue;
    
    if (type === 'email') {
      sanitizedValue = newValue.toLowerCase().trim();
    } else if (type === 'url') {
      sanitizedValue = newValue.trim();
    }
    
    onChange(sanitizedValue);
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  const hasError = showValidation && isTouched && validationError;
  const isValid = showValidation && isTouched && !validationError && value.length > 0;

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
            hasError
              ? 'border-red-300 focus:ring-red-500'
              : isValid
              ? 'border-green-300 focus:ring-green-500'
              : 'border-gray-300 focus:ring-indigo-500'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''} ${
            isPassword ? 'pr-10' : ''
          }`}
        />
        
        {/* Password visibility toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
        
        {/* Validation icons */}
        {showValidation && isTouched && !isPassword && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
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
      
      {/* Security hint for passwords */}
      {isPassword && !isTouched && (
        <p className="text-xs text-gray-500">
          API keys are encrypted and stored securely in your browser
        </p>
      )}
    </div>
  );
}