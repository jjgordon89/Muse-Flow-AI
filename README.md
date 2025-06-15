# Muse-Flow-AI

An intelligent creative writing assistant powered by AI, featuring advanced text processing, semantic search, and multiple AI model integrations for fiction writing.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/jjgordon89/Muse-Flow-AI)

## 🌟 Features

### Core Writing Features
- **Advanced Word Processor**: Rich text editing with auto-save and formatting
- **AI-Powered Writing Assistance**: Multiple AI providers with streaming support
- **Semantic Search**: Find related content using vector embeddings
- **Character Management**: Track and develop characters throughout your story
- **Story Arc Planning**: Organize plot points and narrative structure
- **World Building Tools**: Create and maintain consistent fictional worlds
- **Cross-References**: Link related elements across your writing project

### AI & Machine Learning
- **Multiple AI Providers**: Support for OpenAI, Anthropic Claude, and custom models
- **Vector Embeddings**: ONNX-based local embeddings for semantic search
- **Secure AI Integration**: Encrypted API key storage and secure communication
- **Custom Model Support**: Add and manage your own AI models via OpenAI-compatible API

### Data & Storage
- **Dual Database System**: SQLite for relational data, LanceDB for vector storage
- **Real-time Sync**: Keep your data synchronized across sessions
- **Export/Import**: Backup and restore your projects
- **Offline Support**: Continue writing even without internet connection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jjgordon89/Muse-Flow-AI.git
   cd Muse-Flow-AI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp server/.env.example server/.env
   ```
   Edit [`server/.env`](server/.env) with your API keys and configuration.

4. **Start the application**

   **Frontend only:**
   ```bash
   npm run dev
   ```

   **API server only:**
   ```bash
   npm run dev:server
   ```

   **Full application (frontend + API server):**
   ```bash
   npm run dev:full
   ```

5. **Open your browser**
   - Frontend: `http://localhost:5173`
   - API Server: `http://localhost:3001`

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Headless UI** for accessible components
- **Lucide React** for icons

### Backend Stack
- **Express.js** API server
- **OpenAI-compatible API** endpoints
- **Rate limiting** and security middleware
- **CORS** support for cross-origin requests

### AI & ML Stack
- **Hugging Face Transformers** for model loading
- **ONNX Runtime** for local inference
- **LanceDB** for vector storage
- **Apache Arrow** for efficient data handling

### Database Layer
- **SQLite** for structured data ([`src/database/schemas/sqlite-schema.sql`](src/database/schemas/sqlite-schema.sql))
- **LanceDB** for vector embeddings
- **Sync Manager** for data synchronization

## 📁 Project Structure

```
├── src/
│   ├── components/          # React components
│   │   ├── ai/             # AI-related components
│   │   ├── common/         # Reusable components
│   │   ├── editor/         # Word processor components
│   │   ├── layout/         # App layout components
│   │   └── sidebar/        # Sidebar panels
│   ├── contexts/           # React contexts
│   ├── database/           # Database managers and schemas
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Business logic services
│   ├── test/              # Test files
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── server/                 # Express API server
│   ├── middleware/         # Express middleware
│   ├── routes/            # API routes
│   ├── services/          # Server services
│   └── validators/        # Request validation
└── docs/                  # Documentation
```

## 🔧 Available Scripts

### Development
- [`npm run dev`](package.json:7) - Start frontend development server
- [`npm run dev:server`](package.json:8) - Start API server
- [`npm run dev:full`](package.json:9) - Start both frontend and API server

### Building
- [`npm run build`](package.json:10) - Build for production
- [`npm run preview`](package.json:12) - Preview production build

### Testing
- [`npm run test`](package.json:13) - Run unit tests
- [`npm run test:ui`](package.json:14) - Run tests with UI
- [`npm run test:coverage`](package.json:15) - Run tests with coverage
- [`npm run test:e2e`](package.json:16) - Run end-to-end tests

### Code Quality
- [`npm run lint`](package.json:11) - Lint code
- [`npm run type-check`](package.json:17) - Check TypeScript types

## 🔌 API Documentation

The application includes a comprehensive OpenAI-compatible API server. See [`README-API.md`](README-API.md) for detailed API documentation including:

- Authentication and security
- Chat completions endpoint
- Custom model management
- Client library integration examples
- Rate limiting and error handling

## 🧪 Testing

### Unit Tests
- **Vitest** for fast unit testing
- **Testing Library** for React component testing
- **Happy DOM** for lightweight DOM simulation

### Integration Tests
- AI assistant integration tests
- Database integration tests
- Service layer tests

### End-to-End Tests
- **Playwright** for browser automation
- Full application workflow testing

## 🔒 Security Features

- **Secure Storage**: Encrypted API key storage
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Helmet Security**: HTTP security headers
- **Error Sanitization**: Safe error reporting

## 🎯 Key Components

### AI Integration
- [`EnhancedAIAssistant`](src/components/ai/EnhancedAIAssistant.tsx) - Main AI interface
- [`StreamingAIChat`](src/components/ai/StreamingAIChat.tsx) - Real-time AI responses
- [`SemanticSearch`](src/ai/features/SemanticSearch.ts) - Vector-based content search

### Data Management
- [`DatabaseManager`](src/database/managers/DatabaseManager.ts) - Unified database interface
- [`LanceDBManager`](src/database/managers/LanceDBManager.ts) - Vector database operations
- [`SQLiteManager`](src/database/managers/SQLiteManager.ts) - Relational database operations

### Writing Tools
- [`WordProcessor`](src/components/editor/WordProcessor.tsx) - Main text editor
- [`CharactersPanel`](src/components/sidebar/CharactersPanel.tsx) - Character management
- [`StoryArcsPanel`](src/components/sidebar/StoryArcsPanel.tsx) - Plot organization

## 🌐 Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Note**: Some AI features require modern browser APIs for optimal performance.

## 📊 Performance

- **Virtual Scrolling**: Efficient rendering of large documents
- **Code Splitting**: Lazy loading of components
- **Caching**: Intelligent caching of AI responses and embeddings
- **Debounced Updates**: Optimized user input handling
- **Memory Management**: Proper cleanup of resources

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT models and API design inspiration
- **Anthropic** for Claude integration
- **Hugging Face** for transformer models and tools
- **LanceDB** for vector database technology
- **React Team** for the amazing framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/jjgordon89/Muse-Flow-AI/issues)
- **Documentation**: Check [`README-API.md`](README-API.md) for API details
- **Discussions**: [GitHub Discussions](https://github.com/jjgordon89/Muse-Flow-AI/discussions)

---

**Happy Writing!** ✍️ Let Muse-Flow-AI enhance your creative process with the power of artificial intelligence.