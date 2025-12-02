import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { testPrisma } from '../../setup.js';
import { sepayWebhookPayloads } from '../../mocks/webhooks.js';
import { createWebhookServer } from '../../../src/webhooks/server.js';

describe('SePay Webhook Integration', () => {
  let server: FastifyInstance;
  const testApiKey = process.env.SEPAY_WEBHOOK_SECRET || 'test_sepay_api_key';

  beforeAll(async () => {
    server = await createWebhookServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /webhooks/sepay', () => {
    it('should return 403 for missing authorization', async () => {
      const response = await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .send(sepayWebhookPayloads.paymentReceived);

      expect(response.status).toBe(403);
    });

    it('should return 403 for invalid API key', async () => {
      const response = await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Apikey invalid_key')
        .send(sepayWebhookPayloads.paymentReceived);

      expect(response.status).toBe(403);
    });

    it('should return 200 for valid webhook with Apikey header', async () => {
      const response = await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Apikey ${testApiKey}`)
        .send(sepayWebhookPayloads.paymentReceived);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for valid webhook with Bearer token', async () => {
      const response = await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(sepayWebhookPayloads.paymentReceived);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for outgoing transfers (ignored)', async () => {
      const response = await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Apikey ${testApiKey}`)
        .send(sepayWebhookPayloads.outgoingTransfer);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for duplicate transaction', async () => {
      // Create existing event
      await testPrisma.webhookEvent.create({
        data: {
          externalEventId: '99999999',
          provider: 'SEPAY',
          eventType: 'PAYMENT_IN',
          rawPayload: { test: 'data' },
        },
      });

      const duplicatePayload = {
        ...sepayWebhookPayloads.paymentReceived,
        id: 99999999,
      };

      const response = await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Apikey ${testApiKey}`)
        .send(duplicatePayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should record incoming payment in database', async () => {
      const uniquePayload = {
        ...sepayWebhookPayloads.paymentReceived,
        id: 88888888,
      };

      await request(server.server)
        .post('/webhooks/sepay')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Apikey ${testApiKey}`)
        .send(uniquePayload);

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 100));

      const event = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: '88888888' },
      });

      expect(event).not.toBeNull();
      expect(event?.provider).toBe('SEPAY');
      expect(event?.eventType).toBe('PAYMENT_IN');
    });
  });
});
