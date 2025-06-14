/**
 * Authentication middleware compatible with OpenAI's Bearer token format
 */

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: {
        message: 'Missing authorization header',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Invalid authorization header format. Expected: Bearer <token>',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }

  // Validate token format (similar to OpenAI's API key format)
  if (!isValidApiKey(token)) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key provided',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }

  // Store the token for usage tracking
  req.apiKey = token;
  req.userId = extractUserIdFromToken(token);
  
  next();
};

/**
 * Validate API key format
 */
function isValidApiKey(token) {
  // Accept various token formats:
  // - sk-... (OpenAI format)
  // - Custom format for development
  // - Environment variable for testing
  const validFormats = [
    /^sk-[a-zA-Z0-9]{48}$/, // OpenAI format
    /^afw-[a-zA-Z0-9]{32}$/, // AI Fiction Writer format
    /^dev-[a-zA-Z0-9]+$/, // Development format
  ];

  // Allow specific test tokens
  const testTokens = [
    'test-token',
    'dev-token',
    process.env.API_TEST_TOKEN
  ].filter(Boolean);

  return validFormats.some(format => format.test(token)) || 
         testTokens.includes(token);
}

/**
 * Extract user ID from token for usage tracking
 */
function extractUserIdFromToken(token) {
  if (token.startsWith('sk-')) {
    // For OpenAI-style tokens, use a hash of the token
    return `user_${token.slice(-8)}`;
  }
  
  if (token.startsWith('afw-')) {
    // For our custom tokens, extract user ID
    return `user_${token.slice(4, 12)}`;
  }
  
  if (token.startsWith('dev-')) {
    return 'dev_user';
  }
  
  return 'anonymous_user';
}