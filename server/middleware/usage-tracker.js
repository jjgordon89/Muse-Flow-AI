/**
 * Usage tracking middleware for monitoring API usage
 */

const usageData = new Map();

export const usageTracker = (req, res, next) => {
  const startTime = Date.now();
  
  // Track request
  const userId = req.userId || 'anonymous';
  const endpoint = req.path;
  const method = req.method;
  
  // Initialize user tracking if not exists
  if (!usageData.has(userId)) {
    usageData.set(userId, {
      requests: 0,
      totalTokens: 0,
      lastRequest: Date.now(),
      endpoints: {}
    });
  }

  const userUsage = usageData.get(userId);
  userUsage.requests++;
  userUsage.lastRequest = Date.now();
  
  if (!userUsage.endpoints[endpoint]) {
    userUsage.endpoints[endpoint] = { count: 0, totalTime: 0 };
  }
  userUsage.endpoints[endpoint].count++;

  // Override res.json to track response data
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Track response time
    userUsage.endpoints[endpoint].totalTime += duration;
    
    // Track token usage if present in response
    if (data && data.usage && data.usage.total_tokens) {
      userUsage.totalTokens += data.usage.total_tokens;
    }
    
    // Add usage headers
    res.set({
      'X-Request-ID': req.headers['x-request-id'] || `req_${Date.now()}`,
      'X-Processing-Time': `${duration}ms`,
      'X-Rate-Limit-Remaining': '99', // Placeholder
    });
    
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Get usage statistics for a user
 */
export const getUserUsage = (userId) => {
  return usageData.get(userId) || {
    requests: 0,
    totalTokens: 0,
    lastRequest: null,
    endpoints: {}
  };
};

/**
 * Get overall usage statistics
 */
export const getOverallUsage = () => {
  let totalRequests = 0;
  let totalTokens = 0;
  let uniqueUsers = usageData.size;
  
  for (const usage of usageData.values()) {
    totalRequests += usage.requests;
    totalTokens += usage.totalTokens;
  }
  
  return {
    totalRequests,
    totalTokens,
    uniqueUsers,
    activeUsers: Array.from(usageData.entries())
      .filter(([_, usage]) => Date.now() - usage.lastRequest < 24 * 60 * 60 * 1000)
      .length
  };
};