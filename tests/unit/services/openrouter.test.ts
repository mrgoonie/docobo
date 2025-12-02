import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fetch for testing
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Import after mocking
import { validateApiKey } from '../../../src/services/openrouter.js';

describe('OpenRouter Service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Hello' } }],
          }),
      } as Response);

      const result = await validateApiKey('valid-api-key');
      expect(result).toBe(true);
    });

    it('should return false for invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await validateApiKey('invalid-api-key');
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await validateApiKey('any-key');
      expect(result).toBe(false);
    });
  });
});
