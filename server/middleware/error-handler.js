/**
 * Error handling middleware with OpenAI-compatible error responses
 */

export const errorHandler = (err, req, res, next) => {
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.userId,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let status = 500;
  let errorResponse = {
    error: {
      message: 'Internal server error',
      type: 'internal_server_error',
      code: 'internal_error'
    }
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    errorResponse.error = {
      message: err.message,
      type: 'invalid_request_error',
      code: 'invalid_request'
    };
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    errorResponse.error = {
      message: 'Invalid API key provided',
      type: 'invalid_request_error',
      code: 'invalid_api_key'
    };
  } else if (err.name === 'RateLimitError') {
    status = 429;
    errorResponse.error = {
      message: 'Rate limit exceeded',
      type: 'rate_limit_exceeded',
      code: 'rate_limit_exceeded'
    };
  } else if (err.name === 'TimeoutError') {
    status = 408;
    errorResponse.error = {
      message: 'Request timeout',
      type: 'timeout',
      code: 'timeout'
    };
  } else if (err.status) {
    status = err.status;
    errorResponse.error.message = err.message || errorResponse.error.message;
  }

  // Add request ID for tracking
  errorResponse.error.request_id = req.headers['x-request-id'] || 
                                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  res.status(status).json(errorResponse);
};