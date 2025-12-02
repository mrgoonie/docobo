/**
 * Knowledge Base Types for Customer Service AI
 */

export interface KnowledgeMetadata {
  author?: string;
  category?: string;
  tags?: string[];
  references?: string[];
  wordCount?: number;
}

export interface GeneratedDocument {
  title: string;
  description: string;
  content: string;
  metadata: KnowledgeMetadata;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature?: number;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  description: string;
  relevance: number;
}
