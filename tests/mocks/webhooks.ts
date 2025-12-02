import { createHmac } from 'crypto';

// Polar webhook event payloads
export const polarWebhookPayloads = {
  subscriptionCreated: {
    id: 'evt_polar_test_001',
    type: 'subscription.created',
    data: {
      id: 'sub_polar_test_123',
      status: 'incomplete',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_001',
      customer_id: 'cus_polar_test_001',
    },
  },

  subscriptionActive: {
    id: 'evt_polar_test_002',
    type: 'subscription.active',
    data: {
      id: 'sub_polar_test_123',
      status: 'active',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_001',
      customer_id: 'cus_polar_test_001',
    },
  },

  subscriptionCanceled: {
    id: 'evt_polar_test_003',
    type: 'subscription.canceled',
    data: {
      id: 'sub_polar_test_123',
      status: 'canceled',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_001',
    },
  },

  subscriptionRevoked: {
    id: 'evt_polar_test_004',
    type: 'subscription.revoked',
    data: {
      id: 'sub_polar_test_123',
      status: 'revoked',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_001',
    },
  },

  orderPaid: {
    id: 'evt_polar_test_005',
    type: 'order.paid',
    data: {
      id: 'order_polar_test_001',
      status: 'paid',
      total_amount: 1500,
      currency: 'usd',
    },
  },

  orderRefunded: {
    id: 'evt_polar_test_006',
    type: 'order.refunded',
    data: {
      id: 'sub_polar_test_123',
      status: 'refunded',
    },
  },
};

// SePay webhook transaction payloads
export const sepayWebhookPayloads = {
  paymentReceived: {
    id: 12345678,
    gateway: 'VCB',
    transactionDate: '2025-11-13T10:42:00Z',
    accountNumber: '1234567890',
    subAccount: null,
    transferType: 'in',
    transferAmount: 350000, // 350,000 VND
    accumulated: 350000,
    code: null,
    transactionContent: 'DOCOBO-1234567890123456789-9876543210987654321-1111111111111111111',
    referenceCode: 'DOCOBO-1234567890123456789-9876543210987654321-1111111111111111111',
    description: 'Payment for Premium Member',
  },

  paymentReceivedInvalid: {
    id: 12345679,
    gateway: 'VCB',
    transactionDate: '2025-11-13T10:43:00Z',
    accountNumber: '1234567890',
    subAccount: null,
    transferType: 'in',
    transferAmount: 100000, // Insufficient amount
    accumulated: 100000,
    code: null,
    transactionContent: 'DOCOBO-1234567890123456789-9876543210987654321-1111111111111111111',
    referenceCode: 'DOCOBO-1234567890123456789-9876543210987654321-1111111111111111111',
    description: 'Insufficient payment',
  },

  outgoingTransfer: {
    id: 12345680,
    gateway: 'VCB',
    transactionDate: '2025-11-13T10:44:00Z',
    accountNumber: '1234567890',
    subAccount: null,
    transferType: 'out', // Outgoing - should be ignored
    transferAmount: 100000,
    accumulated: -100000,
    code: null,
    transactionContent: 'Withdrawal',
    referenceCode: '',
    description: 'Outgoing transfer',
  },
};

// Helper to generate valid Standard Webhooks signature
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): { signature: string; headers: Record<string, string> } {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const webhookId = 'msg_test_' + Math.random().toString(36).substring(7);

  // Standard Webhooks: base64(secret) -> HMAC-SHA256(msg_id.timestamp.body)
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
  const signedContent = `${webhookId}.${ts}.${payload}`;
  const hmac = createHmac('sha256', secretBytes);
  hmac.update(signedContent);
  const signature = 'v1,' + hmac.digest('base64');

  return {
    signature,
    headers: {
      'webhook-id': webhookId,
      'webhook-timestamp': String(ts),
      'webhook-signature': signature,
    },
  };
}
