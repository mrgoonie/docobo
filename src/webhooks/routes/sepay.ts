import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env.js';
import { processSepayTransaction } from '../services/sepay-service.js';
import { checkDuplication } from '../utils/deduplication.js';

// SePay webhook transaction structure
interface SepayTransaction {
  id: number; // Transaction ID (primary dedup key)
  gateway: string; // Bank gateway name
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  transferType: string; // 'in' or 'out'
  transferAmount: number;
  accumulated: number;
  code: string | null; // Reference code for matching
  transactionContent: string;
  referenceCode: string;
  description: string;
}

export default function sepayRoutes(server: FastifyInstance): void {
  server.post<{ Body: SepayTransaction }>(
    '/sepay',
    async (request: FastifyRequest<{ Body: SepayTransaction }>, reply: FastifyReply) => {
      try {
        // 1. Verify auth (API Key header)
        const authHeader = request.headers.authorization;
        if (!verifySepayAuth(authHeader)) {
          server.log.warn('SePay webhook auth failed');
          return reply.code(403).send({ success: false, error: 'Unauthorized' });
        }

        const transaction = request.body;
        const transactionId = String(transaction.id);

        // 2. Check deduplication (transaction ID)
        const isDuplicate = await checkDuplication(transactionId, 'SEPAY');
        if (isDuplicate) {
          server.log.info(`Duplicate SePay transaction: ${transactionId}`);
          return reply.code(200).send({ success: true }); // SePay expects this format
        }

        // 3. Only process incoming transfers
        if (transaction.transferType !== 'in') {
          server.log.info(`Ignoring outgoing transfer: ${transactionId}`);
          return reply.code(200).send({ success: true });
        }

        // 4. Acknowledge receipt immediately
        void reply.code(200).send({ success: true });

        // 5. Process async
        setImmediate(() => {
          processSepayTransaction(transaction).catch((error: Error) => {
            server.log.error(
              { err: error },
              `Failed to process SePay transaction ${transactionId}`
            );
          });
        });
      } catch (error) {
        server.log.error({ err: error }, 'SePay webhook error');
        // Return success to prevent retry loop (error logged to DB)
        return reply.code(200).send({ success: true });
      }
    }
  );
}

function verifySepayAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;

  // API Key format: "Apikey <key>"
  if (authHeader.startsWith('Apikey ')) {
    const apiKey = authHeader.substring(7);
    return apiKey === env.SEPAY_WEBHOOK_SECRET;
  }

  // Bearer token format: "Bearer <token>"
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // For SePay, we use the webhook secret as bearer token
    return token === env.SEPAY_WEBHOOK_SECRET;
  }

  return false;
}
