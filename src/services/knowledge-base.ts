/**
 * Knowledge Base Service - CRUD operations with FTS search
 */

import { prisma } from './database.js';
import type { KnowledgeDocument, Prisma } from '@prisma/client';
import type { KnowledgeMetadata, KnowledgeSearchResult } from '../types/knowledge.js';

const PAGE_SIZE = 10;

export interface CreateDocumentInput {
  guildId: string;
  title: string;
  description: string;
  content: string;
  sourceUrl?: string;
  metadata?: KnowledgeMetadata;
}

export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  content?: string;
  metadata?: KnowledgeMetadata;
}

/**
 * Ensure guild exists in database (upsert)
 */
async function ensureGuild(guildId: string, guildName: string): Promise<string> {
  const guild = await prisma.guild.upsert({
    where: { guildId },
    update: { guildName },
    create: { guildId, guildName },
    select: { id: true },
  });
  return guild.id;
}

/**
 * Create a new knowledge document
 */
export async function createDocument(input: CreateDocumentInput): Promise<KnowledgeDocument> {
  const document = await prisma.knowledgeDocument.create({
    data: {
      guildId: input.guildId,
      title: input.title,
      description: input.description,
      content: input.content,
      sourceUrl: input.sourceUrl,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });

  console.log(`[KnowledgeBase] Created document "${document.title}" (${document.id})`);
  return document;
}

/**
 * Get a document by ID
 */
export async function getDocument(id: string): Promise<KnowledgeDocument | null> {
  return prisma.knowledgeDocument.findUnique({
    where: { id },
  });
}

/**
 * List documents for a guild with pagination
 */
export async function listDocuments(
  guildId: string,
  page = 1
): Promise<{ documents: KnowledgeDocument[]; total: number; pages: number }> {
  const skip = (page - 1) * PAGE_SIZE;

  const [documents, total] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.knowledgeDocument.count({
      where: { guildId },
    }),
  ]);

  return {
    documents,
    total,
    pages: Math.ceil(total / PAGE_SIZE),
  };
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  input: UpdateDocumentInput
): Promise<KnowledgeDocument> {
  const document = await prisma.knowledgeDocument.update({
    where: { id },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.description && { description: input.description }),
      ...(input.content && { content: input.content }),
      ...(input.metadata && { metadata: input.metadata as Prisma.InputJsonValue }),
    },
  });

  console.log(`[KnowledgeBase] Updated document "${document.title}" (${document.id})`);
  return document;
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  await prisma.knowledgeDocument.delete({
    where: { id },
  });
  console.log(`[KnowledgeBase] Deleted document ${id}`);
}

/**
 * Search documents using PostgreSQL Full-Text Search
 */
export async function searchDocuments(
  guildId: string,
  query: string,
  limit = 5
): Promise<KnowledgeSearchResult[]> {
  // Use raw query for FTS with ranking
  const results = await prisma.$queryRaw<
    Array<{ id: string; title: string; description: string; rank: number }>
  >`
    SELECT
      id,
      title,
      description,
      ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
    FROM knowledge_documents
    WHERE "guildId" = (SELECT id FROM guilds WHERE "guildId" = ${guildId})
      AND search_vector @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    relevance: r.rank,
  }));
}

/**
 * Check if document belongs to guild
 */
export async function documentBelongsToGuild(docId: string, guildId: string): Promise<boolean> {
  const doc = await prisma.knowledgeDocument.findFirst({
    where: {
      id: docId,
      guild: { guildId },
    },
    select: { id: true },
  });
  return doc !== null;
}

/**
 * Get document count for a guild
 */
export async function getDocumentCount(guildId: string): Promise<number> {
  return prisma.knowledgeDocument.count({
    where: {
      guild: { guildId },
    },
  });
}

export { ensureGuild };
