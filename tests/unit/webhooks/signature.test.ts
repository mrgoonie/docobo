import {
  verifyWebhookSignature,
  WebhookVerificationError,
} from '../../../src/webhooks/utils/signature.js';
import { generateWebhookSignature } from '../../mocks/webhooks.js';

describe('Webhook Signature Verification', () => {
  // Test secret (base64 encoded)
  const testSecret = 'whsec_dGVzdF9zZWNyZXRfdmFsdWVfMTIzNDU2Nzg5MA==';

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ event: 'test', data: { id: '123' } });
      const { headers } = generateWebhookSignature(payload, testSecret);

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).not.toThrow();
    });

    it('should throw error for missing webhook-id header', () => {
      const payload = '{"test": "data"}';
      const headers = {
        'webhook-timestamp': '1700000000',
        'webhook-signature': 'v1,invalid',
      };

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).toThrow(WebhookVerificationError);
    });

    it('should throw error for missing webhook-timestamp header', () => {
      const payload = '{"test": "data"}';
      const headers = {
        'webhook-id': 'msg_123',
        'webhook-signature': 'v1,invalid',
      };

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).toThrow(WebhookVerificationError);
    });

    it('should throw error for missing webhook-signature header', () => {
      const payload = '{"test": "data"}';
      const headers = {
        'webhook-id': 'msg_123',
        'webhook-timestamp': '1700000000',
      };

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).toThrow(WebhookVerificationError);
    });

    it('should throw error for expired timestamp (>5 min)', () => {
      const payload = '{"test": "data"}';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
      const { headers } = generateWebhookSignature(payload, testSecret, oldTimestamp);

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).toThrow(WebhookVerificationError);
    });

    it('should throw error for future timestamp (>5 min)', () => {
      const payload = '{"test": "data"}';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 400; // 6+ minutes from now
      const { headers } = generateWebhookSignature(payload, testSecret, futureTimestamp);

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).toThrow(WebhookVerificationError);
    });

    it('should throw error for invalid signature', () => {
      const payload = '{"test": "data"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const headers = {
        'webhook-id': 'msg_test',
        'webhook-timestamp': String(timestamp),
        'webhook-signature': 'v1,dGhpc19pc19ub3RfYV92YWxpZF9zaWduYXR1cmU=',
      };

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).toThrow(WebhookVerificationError);
    });

    it('should handle array header values', () => {
      const payload = '{"test": "data"}';
      const { headers } = generateWebhookSignature(payload, testSecret);

      // Convert to array format (some HTTP frameworks do this)
      const arrayHeaders: Record<string, string | string[]> = {
        'webhook-id': [headers['webhook-id']],
        'webhook-timestamp': [headers['webhook-timestamp']],
        'webhook-signature': [headers['webhook-signature']],
      };

      expect(() => {
        verifyWebhookSignature(payload, arrayHeaders, testSecret);
      }).not.toThrow();
    });

    it('should verify with recent timestamp (within 5 min)', () => {
      const payload = JSON.stringify({ data: 'test' });
      const recentTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      const { headers } = generateWebhookSignature(payload, testSecret, recentTimestamp);

      expect(() => {
        verifyWebhookSignature(payload, headers, testSecret);
      }).not.toThrow();
    });
  });

  describe('WebhookVerificationError', () => {
    it('should be instanceof Error', () => {
      const error = new WebhookVerificationError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WebhookVerificationError);
      expect(error.message).toBe('Test error');
    });
  });
});
