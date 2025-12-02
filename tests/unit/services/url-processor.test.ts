import { describe, expect, it } from '@jest/globals';
import { isValidUrl, processText } from '../../../src/services/url-processor.js';

describe('URL Processor', () => {
  describe('isValidUrl', () => {
    it('should return true for valid http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should return true for valid https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('processText', () => {
    it('should return trimmed text', () => {
      expect(processText('  hello world  ')).toBe('hello world');
    });

    it('should truncate text over 10000 chars', () => {
      const longText = 'a'.repeat(15000);
      const result = processText(longText);
      expect(result.length).toBeLessThan(15000);
      expect(result).toContain('[Content truncated...]');
    });

    it('should not truncate text under 10000 chars', () => {
      const shortText = 'a'.repeat(1000);
      expect(processText(shortText)).toBe(shortText);
    });
  });
});
