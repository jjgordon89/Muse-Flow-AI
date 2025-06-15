import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { chatCompletionsRouter } from './routes/chat-completions.js';
import { completionsRouter } from './routes/completions.js';
import { modelsRouter } from './routes/models.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { usageTracker } from './middleware/usage-tracker.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for API responses
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: 'Rate limit exceeded',
      type: 'rate_limit_exceeded',
      code: 'rate_limit_exceeded'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Usage tracking middleware
app.use(usageTracker);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation endpoint
app.get('/v1', (req, res) => {
  res.json({
    name: 'AI Fiction Writer API',
    version: '1.0.0',
    description: 'OpenAI-compatible API for AI Fiction Writer',
    endpoints: {
      'chat/completions': 'POST /v1/chat/completions',
      'completions': 'POST /v1/completions',
      'models': 'GET /v1/models'
    },
    documentation: 'https://platform.openai.com/docs/api-reference',
    compatibility: 'OpenAI API v1'
  });
});

// Authentication middleware for API routes
app.use('/v1', authMiddleware);

// API routes
app.use('/v1/chat', chatCompletionsRouter);
app.use('/v1', completionsRouter);
app.use('/v1', modelsRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      type: 'invalid_request_error',
      code: 'not_found'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Fiction Writer API Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/v1`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔒 Authentication required for API endpoints`);
});

export default app;