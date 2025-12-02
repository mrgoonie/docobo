/**
 * OpenRouter API Service for LLM-powered document generation
 */

import type {
  OpenRouterConfig,
  OpenRouterResponse,
  GeneratedDocument,
} from '../types/knowledge.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash-preview-05-20';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const DOCUMENT_GENERATION_PROMPT = `You are a knowledge base document generator. Given content (from a URL or raw text), create a structured markdown document with YAML frontmatter.

Output EXACTLY in this format:
---
title: [Concise descriptive title]
description: [1-2 sentence summary for search/SEO]
category: [Single category: guide, reference, tutorial, faq, policy, or general]
tags: [comma-separated relevant keywords]
---

[Main content in clean markdown format. Use headers, lists, and code blocks as appropriate. Keep it organized and scannable.]

Rules:
- Title should be clear and descriptive (max 100 chars)
- Description is crucial for search - make it informative
- Category must be one of: guide, reference, tutorial, faq, policy, general
- Extract 3-7 relevant tags
- Content should be well-organized markdown
- Preserve code examples with proper formatting
- Remove navigation, ads, and irrelevant content
- Keep essential information only`;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse YAML frontmatter and content from generated markdown
 */
function parseGeneratedDocument(markdown: string): GeneratedDocument | null {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    console.error('Failed to parse frontmatter from generated document');
    return null;
  }

  const [, yamlContent, bodyContent] = frontmatterMatch;

  // Simple YAML parsing (avoiding dependencies)
  const lines = yamlContent.split('\n');
  const metadata: Record<string, string | string[]> = {};

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      if (key === 'tags') {
        metadata[key] = value.split(',').map((t) => t.trim());
      } else {
        metadata[key] = value.trim();
      }
    }
  }

  const title = (metadata.title as string) || 'Untitled Document';
  const description = (metadata.description as string) || '';
  const category = (metadata.category as string) || 'general';
  const tags = (metadata.tags as string[]) || [];

  return {
    title,
    description,
    content: bodyContent.trim(),
    metadata: {
      category,
      tags,
      wordCount: bodyContent.split(/\s+/).length,
    },
  };
}

/**
 * Generate a knowledge document from raw content using OpenRouter API
 */
export async function generateDocument(
  content: string,
  config: Partial<OpenRouterConfig> & { apiKey: string }
): Promise<GeneratedDocument> {
  const { apiKey, model = DEFAULT_MODEL, maxTokens = 4096, temperature = 0.3 } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://docobo.io',
          'X-Title': 'Docobo Discord Bot',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: DOCUMENT_GENERATION_PROMPT },
            { role: 'user', content: `Process this content:\n\n${content}` },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Empty response from OpenRouter API');
      }

      const generatedContent = data.choices[0].message.content;
      const parsed = parseGeneratedDocument(generatedContent);

      if (!parsed) {
        throw new Error('Failed to parse generated document');
      }

      console.log(
        `[OpenRouter] Generated document: "${parsed.title}" (${data.usage?.total_tokens || 0} tokens)`
      );

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[OpenRouter] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, lastError.message);

      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Failed to generate document after retries');
}

/**
 * Validate OpenRouter API key by making a minimal request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
