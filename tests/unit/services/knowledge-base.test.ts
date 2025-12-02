import { describe, expect, it, beforeEach } from '@jest/globals';
import { testPrisma } from '../../setup.js';
import * as knowledgeBase from '../../../src/services/knowledge-base.js';

describe('Knowledge Base Service', () => {
  let testGuildId: string;

  beforeEach(async () => {
    // Create test guild
    const guild = await testPrisma.guild.create({
      data: {
        guildId: '1234567890123456789',
        guildName: 'Test Server',
      },
    });
    testGuildId = guild.id;
  });

  describe('createDocument', () => {
    it('should create a document with all fields', async () => {
      const doc = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'Test Document',
        description: 'A test description',
        content: 'This is test content',
        sourceUrl: 'https://example.com',
        metadata: { category: 'test', tags: ['tag1', 'tag2'] },
      });

      expect(doc.id).toBeDefined();
      expect(doc.title).toBe('Test Document');
      expect(doc.description).toBe('A test description');
      expect(doc.content).toBe('This is test content');
      expect(doc.sourceUrl).toBe('https://example.com');
    });

    it('should create a document without optional fields', async () => {
      const doc = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'Minimal Doc',
        description: 'Minimal description',
        content: 'Content',
      });

      expect(doc.id).toBeDefined();
      expect(doc.sourceUrl).toBeNull();
    });
  });

  describe('getDocument', () => {
    it('should return document by ID', async () => {
      const created = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'Find Me',
        description: 'Description',
        content: 'Content',
      });

      const found = await knowledgeBase.getDocument(created.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const found = await knowledgeBase.getDocument('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('should return paginated documents', async () => {
      // Create 15 documents
      for (let i = 0; i < 15; i++) {
        await knowledgeBase.createDocument({
          guildId: testGuildId,
          title: `Doc ${i}`,
          description: `Description ${i}`,
          content: `Content ${i}`,
        });
      }

      const page1 = await knowledgeBase.listDocuments(testGuildId, 1);
      expect(page1.documents.length).toBe(10);
      expect(page1.total).toBe(15);
      expect(page1.pages).toBe(2);

      const page2 = await knowledgeBase.listDocuments(testGuildId, 2);
      expect(page2.documents.length).toBe(5);
    });

    it('should return empty for guild with no documents', async () => {
      const result = await knowledgeBase.listDocuments(testGuildId, 1);
      expect(result.documents.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('updateDocument', () => {
    it('should update document fields', async () => {
      const created = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'Original Title',
        description: 'Original description',
        content: 'Original content',
      });

      const updated = await knowledgeBase.updateDocument(created.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated description');
      expect(updated.content).toBe('Original content'); // Unchanged
    });
  });

  describe('deleteDocument', () => {
    it('should delete document', async () => {
      const created = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'To Delete',
        description: 'Description',
        content: 'Content',
      });

      await knowledgeBase.deleteDocument(created.id);

      const found = await knowledgeBase.getDocument(created.id);
      expect(found).toBeNull();
    });
  });

  describe('documentBelongsToGuild', () => {
    it('should return true for document in guild', async () => {
      const created = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'My Doc',
        description: 'Description',
        content: 'Content',
      });

      const belongs = await knowledgeBase.documentBelongsToGuild(created.id, '1234567890123456789');
      expect(belongs).toBe(true);
    });

    it('should return false for document in different guild', async () => {
      const created = await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'My Doc',
        description: 'Description',
        content: 'Content',
      });

      const belongs = await knowledgeBase.documentBelongsToGuild(created.id, '9999999999999999999');
      expect(belongs).toBe(false);
    });
  });

  describe('getDocumentCount', () => {
    it('should return correct count', async () => {
      await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'Doc 1',
        description: 'Description',
        content: 'Content',
      });
      await knowledgeBase.createDocument({
        guildId: testGuildId,
        title: 'Doc 2',
        description: 'Description',
        content: 'Content',
      });

      const count = await knowledgeBase.getDocumentCount('1234567890123456789');
      expect(count).toBe(2);
    });
  });
});
