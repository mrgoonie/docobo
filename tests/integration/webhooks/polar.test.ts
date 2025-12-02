import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { testPrisma } from '../../setup.js';
import { polarWebhookPayloads, generateWebhookSignature } from '../../mocks/webhooks.js';
import { createWebhookServer } from '../../../src/webhooks/server.js';

describe('Polar Webhook Integration', () => {
  let server: FastifyInstance;
  const testSecret =
    process.env.POLAR_WEBHOOK_SECRET || 'whsec_dGVzdF9zZWNyZXRfdmFsdWVfMTIzNDU2Nzg5MA==';

  beforeAll(async () => {
    server = await createWebhookServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /webhooks/polar', () => {
    it('should return 403 for missing signature', async () => {
      const response = await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .send(polarWebhookPayloads.subscriptionCreated);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should return 403 for invalid signature', async () => {
      const response = await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .set('webhook-id', 'msg_test')
        .set('webhook-timestamp', String(Math.floor(Date.now() / 1000)))
        .set('webhook-signature', 'v1,aW52YWxpZF9zaWduYXR1cmU=')
        .send(polarWebhookPayloads.subscriptionCreated);

      expect(response.status).toBe(403);
    });

    it('should return 202 for valid webhook', async () => {
      const payload = JSON.stringify(polarWebhookPayloads.subscriptionCreated);
      const { headers } = generateWebhookSignature(payload, testSecret);

      const response = await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .set('webhook-id', headers['webhook-id'])
        .set('webhook-timestamp', headers['webhook-timestamp'])
        .set('webhook-signature', headers['webhook-signature'])
        .send(polarWebhookPayloads.subscriptionCreated);

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for duplicate event', async () => {
      // Create existing event
      await testPrisma.webhookEvent.create({
        data: {
          externalEventId: 'evt_duplicate_polar_001',
          provider: 'POLAR',
          eventType: 'SUBSCRIPTION_CREATED',
          rawPayload: { data: 'test' },
        },
      });

      const duplicatePayload = {
        ...polarWebhookPayloads.subscriptionCreated,
        id: 'evt_duplicate_polar_001',
      };

      const payloadStr = JSON.stringify(duplicatePayload);
      const { headers } = generateWebhookSignature(payloadStr, testSecret);

      const response = await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .set('webhook-id', headers['webhook-id'])
        .set('webhook-timestamp', headers['webhook-timestamp'])
        .set('webhook-signature', headers['webhook-signature'])
        .send(duplicatePayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Duplicate');
    });

    it('should record webhook event in database', async () => {
      const uniquePayload = {
        ...polarWebhookPayloads.subscriptionActive,
        id: 'evt_record_test_001',
      };

      const payloadStr = JSON.stringify(uniquePayload);
      const { headers } = generateWebhookSignature(payloadStr, testSecret);

      await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .set('webhook-id', headers['webhook-id'])
        .set('webhook-timestamp', headers['webhook-timestamp'])
        .set('webhook-signature', headers['webhook-signature'])
        .send(uniquePayload);

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 100));

      const event = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_record_test_001' },
      });

      expect(event).not.toBeNull();
      expect(event?.provider).toBe('POLAR');
    });
  });

  describe('Health Check', () => {
    it('should return 200 on /health', async () => {
      const response = await request(server.server).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
});
