import { SearchOptions, SearchResult } from './IRepository';

/**
 * Base Service Interface
 */
export interface IService {
  readonly name: string;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

/**
 * Project Management Service
 */
export interface IProjectService extends IService {
  createProject(data: CreateProjectData): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  listProjects(userId?: string): Promise<Project[]>;
  duplicateProject(id: string, newTitle?: string): Promise<Project>;
  getProjectStats(id: string): Promise<ProjectStats>;
  exportProject(id: string, format: ExportFormat): Promise<ExportResult>;
  importProject(data: ImportData): Promise<Project>;
}

/**
 * Content Management Service
 */
export interface IContentService extends IService {
  addContent(projectId: string, content: CreateContentData): Promise<ContentBlock>;
  updateContent(id: string, updates: Partial<ContentBlock>): Promise<ContentBlock>;
  deleteContent(id: string): Promise<void>;
  getContent(id: string): Promise<ContentBlock | null>;
  getProjectContent(projectId: string, type?: string): Promise<ContentBlock[]>;
  searchContent(projectId: string, query: string, options?: SearchOptions): Promise<SearchResult<ContentBlock>[]>;
  getContentHistory(id: string): Promise<ContentVersion[]>;
  restoreContentVersion(id: string, versionId: string): Promise<ContentBlock>;
}

/**
 * AI Integration Service
 */
export interface IAIService extends IService {
  generateContent(request: AIGenerationRequest): Promise<AIGenerationResponse>;
  generateSuggestions(context: AIContext): Promise<AISuggestion[]>;
  analyzeContent(content: string, type: AnalysisType): Promise<ContentAnalysis>;
  improveContent(content: string, improvements: ImprovementType[]): Promise<string>;
  getAvailableModels(): Promise<AIModel[]>;
  getProviderStatus(): Promise<ProviderStatus[]>;
  setDefaultProvider(providerId: string): Promise<void>;
  configureProvider(providerId: string, config: ProviderConfig): Promise<void>;
}

/**
 * Search and Semantic Analysis Service
 */
export interface ISemanticService extends IService {
  semanticSearch(query: string, options: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
  findSimilarContent(contentId: string, threshold?: number): Promise<SimilarityResult[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  analyzeThemes(projectId: string): Promise<ThemeAnalysis>;
  detectInconsistencies(projectId: string): Promise<Inconsistency[]>;
  suggestConnections(projectId: string): Promise<ConnectionSuggestion[]>;
}

/**
 * Collaboration Service
 */
export interface ICollaborationService extends IService {
  createSession(projectId: string, userId: string): Promise<CollaborationSession>;
  joinSession(sessionId: string, userId: string): Promise<void>;
  leaveSession(sessionId: string, userId: string): Promise<void>;
  broadcastChange(sessionId: string, change: CollaborationChange): Promise<void>;
  getActiveUsers(sessionId: string): Promise<ActiveUser[]>;
  resolveConflicts(conflicts: ContentConflict[]): Promise<ConflictResolution[]>;
  saveCheckpoint(sessionId: string): Promise<Checkpoint>;
  restoreCheckpoint(sessionId: string, checkpointId: string): Promise<void>;
}

/**
 * Monitoring and Analytics Service
 */
export interface IMonitoringService extends IService {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  trackPerformance(metric: PerformanceMetric): Promise<void>;
  trackError(error: ErrorEvent): Promise<void>;
  getAnalytics(projectId: string, timeRange: TimeRange): Promise<Analytics>;
  getPerformanceMetrics(timeRange: TimeRange): Promise<PerformanceReport>;
  getHealthStatus(): Promise<HealthStatus>;
  generateReport(type: ReportType, options: ReportOptions): Promise<Report>;
}

// Type definitions for service interfaces

export interface Project {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  target_word_count: number;
  current_word_count: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface CreateProjectData {
  title: string;
  description?: string;
  genre?: string;
  target_word_count?: number;
}

export interface ProjectStats {
  wordCount: number;
  characterCount: number;
  chapterCount: number;
  sceneCount: number;
  lastModified: Date;
  completionPercentage: number;
  writingStreak: number;
  averageDailyWords: number;
}

export interface ContentBlock {
  id: string;
  project_id: string;
  content_type: string;
  content_id?: string;
  content_text: string;
  word_count: number;
  created_at: string;
  updated_at: string;
  version?: number;
  metadata?: Record<string, any>;
}

export interface CreateContentData {
  content_type: string;
  content_id?: string;
  content_text: string;
  metadata?: Record<string, any>;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  content_text: string;
  changes_summary?: string;
  created_at: string;
  created_by?: string;
}

export interface AIGenerationRequest {
  prompt: string;
  type: 'completion' | 'suggestion' | 'improvement' | 'analysis';
  context?: string;
  model?: string;
  provider?: string;
  parameters?: Record<string, any>;
}

export interface AIGenerationResponse {
  content: string;
  type: string;
  model: string;
  provider: string;
  usage?: TokenUsage;
  metadata?: Record<string, any>;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIContext {
  projectId: string;
  contentType: string;
  currentContent: string;
  selectedText?: string;
  characterContext?: string[];
  plotContext?: string[];
}

export interface AISuggestion {
  id: string;
  type: 'completion' | 'improvement' | 'alternative';
  content: string;
  confidence: number;
  reasoning?: string;
}

export interface ContentAnalysis {
  readabilityScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  themes: string[];
  characters: string[];
  inconsistencies: string[];
  suggestions: string[];
}

export type AnalysisType = 'readability' | 'sentiment' | 'character' | 'plot' | 'themes';
export type ImprovementType = 'grammar' | 'style' | 'clarity' | 'engagement' | 'pacing';
export type ExportFormat = 'docx' | 'pdf' | 'epub' | 'txt' | 'html' | 'markdown';
export type ReportType = 'analytics' | 'performance' | 'usage' | 'errors';

export interface SemanticSearchOptions extends SearchOptions {
  threshold?: number;
  includeMetadata?: boolean;
  contentTypes?: string[];
}

export interface SemanticSearchResult extends SearchResult<ContentBlock> {
  similarity: number;
  context: string;
}

export interface SimilarityResult {
  content: ContentBlock;
  similarity: number;
  commonThemes: string[];
}

export interface ThemeAnalysis {
  primaryThemes: Theme[];
  characterThemes: Record<string, Theme[]>;
  themeProgression: ThemeProgression[];
}

export interface Theme {
  name: string;
  frequency: number;
  sentiment: number;
  locations: ContentLocation[];
}

export interface ContentLocation {
  contentId: string;
  position: number;
  context: string;
}

export interface ThemeProgression {
  theme: string;
  timeline: Array<{ position: number; intensity: number }>;
}

export interface Inconsistency {
  type: 'character' | 'plot' | 'setting' | 'timeline';
  description: string;
  locations: ContentLocation[];
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export interface ConnectionSuggestion {
  type: 'character_relationship' | 'plot_connection' | 'theme_link';
  description: string;
  confidence: number;
  elements: string[];
  suggestedAction: string;
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
  participants: string[];
}

export interface CollaborationChange {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'insert' | 'delete' | 'update';
  contentId: string;
  changes: TextChange[];
}

export interface TextChange {
  position: number;
  length: number;
  text: string;
  operation: 'insert' | 'delete' | 'replace';
}

export interface ActiveUser {
  id: string;
  name: string;
  cursor?: CursorPosition;
  selection?: TextSelection;
  color: string;
  isOnline: boolean;
}

export interface CursorPosition {
  contentId: string;
  position: number;
}

export interface TextSelection {
  contentId: string;
  start: number;
  end: number;
}

export interface ContentConflict {
  id: string;
  contentId: string;
  conflictingChanges: CollaborationChange[];
  timestamp: Date;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'accept_local' | 'accept_remote' | 'merge' | 'manual';
  mergedContent?: string;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: Date;
  description: string;
  contentSnapshot: Record<string, string>;
}

export interface AnalyticsEvent {
  type: string;
  userId?: string;
  projectId?: string;
  timestamp: Date;
  properties: Record<string, any>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface ErrorEvent {
  message: string;
  stack?: string;
  userId?: string;
  projectId?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface Analytics {
  totalEvents: number;
  uniqueUsers: number;
  topEvents: Array<{ event: string; count: number }>;
  userActivity: Array<{ date: string; activeUsers: number }>;
  featureUsage: Record<string, number>;
}

export interface PerformanceReport {
  averageLoadTime: number;
  averageApiResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  lastCheck: Date;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  errorRate?: number;
  lastError?: string;
}

export interface Report {
  id: string;
  type: ReportType;
  generatedAt: Date;
  data: any;
  format: 'json' | 'csv' | 'pdf';
}

export interface ReportOptions {
  timeRange: TimeRange;
  filters?: Record<string, any>;
  format?: 'json' | 'csv' | 'pdf';
  includeCharts?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  type: 'completion' | 'chat' | 'embedding';
  maxTokens: number;
  costPer1kTokens: number;
  capabilities: string[];
}

export interface ProviderStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  responseTime: number;
  errorRate: number;
  availableModels: string[];
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
  customHeaders?: Record<string, string>;
}

export interface ImportData {
  format: 'json' | 'docx' | 'txt' | 'markdown';
  content: string | Uint8Array;
  options?: Record<string, any>;
}

export interface ExportResult {
  format: ExportFormat;
  data: Uint8Array;
  filename: string;
  metadata?: Record<string, any>;
}