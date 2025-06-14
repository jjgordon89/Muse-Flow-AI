import { 
  SemanticSearchOptions,
  SemanticSearchResult
} from '../../database/types/database-types';
import { EmbeddingProvider } from '../types/embedding-types';

// Define interfaces for better type safety
interface VectorDatabase {
  search(embeddingVector: number[], options: SemanticSearchOptions): Promise<DatabaseSearchResult[]>;
  getEmbedding(id: string): Promise<VectorEmbedding | null>;
}

interface VectorEmbedding {
  id: string;
  project_id: string;
  content_type: string;
  content_text: string;
  embedding_vector: number[];
  metadata: EmbeddingMetadata;
}

interface EmbeddingMetadata {
  word_count: number;
  timestamp: string;
  character_names?: string[];
  themes?: string[];
  section_type?: string;
}

interface DatabaseSearchResult {
  id: string;
  content_text: string;
  content_type: string;
  similarity_score: number;
  metadata: Record<string, unknown>;
  source_id: string;
}

interface MetadataFilters {
  character_names?: string[];
  themes?: string[];
  min_word_count?: number;
  max_word_count?: number;
}

export interface SearchFilters {
  contentTypes?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  characterNames?: string[];
  locations?: string[];
  themes?: string[];
  minWordCount?: number;
  maxWordCount?: number;
}

export interface SearchSuggestion {
  query: string;
  description: string;
  filters?: SearchFilters;
}

export interface SearchContext {
  projectId: string;
  currentContent?: string;
  selectedCharacters?: string[];
  activeScene?: string;
}

export class SemanticSearchService {
  private embeddingProvider: EmbeddingProvider;
  private vectorDatabase: VectorDatabase;
  private searchHistory: string[] = [];

  constructor(embeddingProvider: EmbeddingProvider, vectorDatabase: VectorDatabase) {
    this.embeddingProvider = embeddingProvider;
    this.vectorDatabase = vectorDatabase;
  }

  async search(
    query: string, 
    options: Partial<SemanticSearchOptions> = {},
    filters?: SearchFilters
  ): Promise<SemanticSearchResult[]> {
    try {
      // Record search in history
      this.addToHistory(query);

      // Generate embedding for the search query
      const queryEmbeddings = await this.embeddingProvider.generateEmbeddings([query]);
      const queryVector = queryEmbeddings[0];

      if (!queryVector) {
        throw new Error('Failed to generate search embedding');
      }

      // Build search options
      const searchOptions: SemanticSearchOptions = {
        query,
        similarity_threshold: 0.6,
        max_results: 50,
        ...options
      };

      // Apply filters
      if (filters) {
        if (filters.contentTypes) {
          searchOptions.content_types = filters.contentTypes;
        }
        searchOptions.metadata_filters = this.buildMetadataFilters(filters);
      }

      // Perform vector search
      let results = await this.vectorDatabase.search(queryVector, searchOptions);

      // Post-process results
      results = this.postProcessResults(results, filters);

      // Sort by relevance and recency
      results = this.sortResults(results, query);

      return results;

    } catch (error) {
      console.error('Semantic search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async findSimilarContent(
    contentId: string,
    contentType: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SemanticSearchResult[]> {
    try {
      // Get the source embedding
      const embeddingId = `emb_${contentType}_${contentId}`;
      const sourceEmbedding = await this.vectorDatabase.getEmbedding(embeddingId);

      if (!sourceEmbedding) {
        throw new Error('Source content embedding not found');
      }

      // Search for similar content
      const results = await this.vectorDatabase.search(sourceEmbedding.embedding_vector, {
        query: '',
        max_results: limit + 1, // +1 to account for the source itself
        similarity_threshold: threshold,
        project_id: sourceEmbedding.project_id
      });      // Filter out the source content
      return results.filter((result: DatabaseSearchResult) => result.id !== embeddingId);

    } catch (error) {
      console.error('Similar content search failed:', error);
      throw new Error(`Similar content search failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async suggestQueries(context: SearchContext): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // Context-based suggestions
    if (context.currentContent) {
      suggestions.push({
        query: `content similar to current scene`,
        description: 'Find scenes with similar themes or settings',
        filters: { contentTypes: ['scene_description'] }
      });
    }

    if (context.selectedCharacters && context.selectedCharacters.length > 0) {
      suggestions.push({
        query: `scenes with ${context.selectedCharacters.join(' and ')}`,
        description: 'Find scenes featuring these characters',
        filters: { 
          contentTypes: ['scene_description'],
          characterNames: context.selectedCharacters 
        }
      });
    }

    // Add general creative suggestions
    suggestions.push(...this.getCreativeSuggestions());

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }

  async searchByTheme(theme: string, projectId: string): Promise<SemanticSearchResult[]> {
    const themeQueries = [
      `${theme} theme elements`,
      `${theme} character development`,
      `${theme} plot points`,
      `${theme} symbolism and metaphors`
    ];

    const allResults: SemanticSearchResult[] = [];

    for (const query of themeQueries) {
      const results = await this.search(query, {
        project_id: projectId,
        max_results: 15,
        similarity_threshold: 0.6
      });
      allResults.push(...results);
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = this.removeDuplicates(allResults);
    return uniqueResults.slice(0, 20);
  }

  async findPlotHoles(projectId: string): Promise<{
    gaps: SemanticSearchResult[];
    inconsistencies: { 
      content1: SemanticSearchResult;
      content2: SemanticSearchResult;
      conflict: string;
    }[];
  }> {
    // Search for plot-related content
    const plotQueries = [
      'character motivations and goals',
      'cause and effect relationships',
      'timeline and chronology',
      'character abilities and limitations'
    ];

    const plotElements: SemanticSearchResult[] = [];
    
    for (const query of plotQueries) {
      const results = await this.search(query, {
        project_id: projectId,
        content_types: ['story_content', 'character_description'],
        max_results: 20
      });
      plotElements.push(...results);
    }

    // Analyze for potential inconsistencies
    const inconsistencies = await this.detectInconsistencies(plotElements);    // Identify potential gaps (this is a simplified approach)
    const gaps = plotElements.filter(element => 
      element.similarity_score < 0.7 && 
      (element.metadata['word_count'] as number) < 50
    );

    return { gaps, inconsistencies };
  }
  private buildMetadataFilters(filters: SearchFilters): MetadataFilters {
    const metadataFilters: MetadataFilters = {};

    if (filters.characterNames && filters.characterNames.length > 0) {
      metadataFilters['character_names'] = filters.characterNames;
    }

    if (filters.themes && filters.themes.length > 0) {
      metadataFilters['themes'] = filters.themes;
    }

    if (filters.minWordCount) {
      metadataFilters['min_word_count'] = filters.minWordCount;
    }

    if (filters.maxWordCount) {
      metadataFilters['max_word_count'] = filters.maxWordCount;
    }

    return metadataFilters;
  }

  private postProcessResults(
    results: SemanticSearchResult[], 
    filters?: SearchFilters
  ): SemanticSearchResult[] {
    let filteredResults = [...results];    // Apply additional filters
    if (filters?.dateRange) {
      filteredResults = filteredResults.filter(result => {
        const contentDate = new Date(result.metadata['timestamp'] as string);
        return contentDate >= filters.dateRange!.start && contentDate <= filters.dateRange!.end;
      });
    }

    if (filters?.minWordCount) {
      filteredResults = filteredResults.filter(result => 
        (result.metadata['word_count'] as number) >= filters.minWordCount!
      );
    }

    if (filters?.maxWordCount) {
      filteredResults = filteredResults.filter(result => 
        (result.metadata['word_count'] as number) <= filters.maxWordCount!
      );
    }

    return filteredResults;
  }

  private sortResults(results: SemanticSearchResult[], query: string): SemanticSearchResult[] {
    return results.sort((a, b) => {
      // Primary sort: similarity score
      const scoreDiff = b.similarity_score - a.similarity_score;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

      // Secondary sort: keyword relevance
      const aKeywordScore = this.calculateKeywordRelevance(a.content_text, query);
      const bKeywordScore = this.calculateKeywordRelevance(b.content_text, query);
      const keywordDiff = bKeywordScore - aKeywordScore;
      if (Math.abs(keywordDiff) > 0.1) return keywordDiff;      // Tertiary sort: recency
      const aTime = new Date(a.metadata['timestamp'] as string).getTime();
      const bTime = new Date(b.metadata['timestamp'] as string).getTime();
      return bTime - aTime;
    });
  }

  private calculateKeywordRelevance(text: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (textWords.some(textWord => textWord.includes(queryWord) || queryWord.includes(textWord))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  private removeDuplicates(results: SemanticSearchResult[]): SemanticSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.id)) return false;
      seen.add(result.id);
      return true;
    });
  }

  private async detectInconsistencies(elements: SemanticSearchResult[]): Promise<{
    content1: SemanticSearchResult;
    content2: SemanticSearchResult;
    conflict: string;
  }[]> {
    const inconsistencies: {
      content1: SemanticSearchResult;
      content2: SemanticSearchResult;
      conflict: string;
    }[] = [];    // This is a simplified approach - in a real implementation,
    // you might use more sophisticated NLP techniques
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const element1 = elements[i];
        const element2 = elements[j];

        // Check for potential conflicts (simplified logic)
        if (element1 && element2 && this.mayHaveConflict(element1.content_text, element2.content_text)) {
          inconsistencies.push({
            content1: element1,
            content2: element2,
            conflict: 'Potential character or plot inconsistency detected'
          });
        }
      }
    }

    return inconsistencies.slice(0, 10); // Limit results
  }
  private mayHaveConflict(text1: string, text2: string): boolean {
    // Simplified conflict detection
    const conflictKeywords: [string, string][] = [
      ['dead', 'alive'],
      ['never', 'always'],
      ['can\'t', 'can'],
      ['impossible', 'possible']
    ];

    const text1Lower = text1.toLowerCase();
    const text2Lower = text2.toLowerCase();

    return conflictKeywords.some(([word1, word2]) => 
      (text1Lower.includes(word1) && text2Lower.includes(word2)) ||
      (text1Lower.includes(word2) && text2Lower.includes(word1))
    );
  }

  private getCreativeSuggestions(): SearchSuggestion[] {
    return [
      {
        query: 'character development and growth',
        description: 'Find character evolution throughout the story'
      },
      {
        query: 'emotional turning points',
        description: 'Locate pivotal emotional moments'
      },
      {
        query: 'conflict and tension scenes',
        description: 'Find high-stakes dramatic moments'
      },
      {
        query: 'world building details',
        description: 'Explore setting and environment descriptions'
      },
      {
        query: 'dialogue and conversations',
        description: 'Find important character interactions'
      }
    ];
  }
  private addToHistory(query: string): void {
    this.searchHistory.unshift(query);
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }
  }

  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  clearSearchHistory(): void {
    this.searchHistory = [];
  }

  getPopularSearches(): string[] {
    // In a real implementation, you might track search frequency
    return [
      'character relationships',
      'plot holes',
      'similar scenes',
      'theme development',
      'dialogue quality'
    ];
  }
}