/**
 * URL Processor Service - Fetches and extracts text content from URLs
 * Supports llms.txt protocol for AI-optimized content
 */

const MAX_CONTENT_LENGTH = 10000; // 10K chars for LLM context
const FETCH_TIMEOUT = 10000; // 10 seconds

// Private IP patterns (RFC 1918, RFC 4193, link-local, loopback, cloud metadata)
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback IPv4
  /^10\./, // Class A private
  /^192\.168\./, // Class C private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private (172.16-31.x.x)
  /^169\.254\./, // Link-local / cloud metadata
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-7])\./, // Carrier-grade NAT
  /^::1$/, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd[0-9a-f]{2}:/i, // IPv6 unique local
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254', // AWS/GCP metadata
];

/**
 * Check if URL is safe (no internal IPs, localhost, or cloud metadata)
 */
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Block known dangerous hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return false;
    }

    // Block private/internal IP addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Docobo Knowledge Bot/1.0 (+https://docobo.io)',
        Accept: 'text/html,text/plain,text/markdown,application/json',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Strip HTML tags and extract text content
 */
function stripHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove nav, header, footer, aside elements
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // Replace common block elements with newlines
  text = text.replace(/<(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n');

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#(\d+);/g, (_match: string, num: string) =>
    String.fromCharCode(parseInt(num, 10))
  );

  // Clean up whitespace
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.trim();

  return text;
}

/**
 * Try to fetch llms.txt from a domain
 */
async function fetchLlmsTxt(baseUrl: string): Promise<string | null> {
  try {
    const parsed = new URL(baseUrl);
    const llmsTxtUrl = `${parsed.protocol}//${parsed.host}/llms.txt`;

    console.log(`[URLProcessor] Checking for llms.txt at ${llmsTxtUrl}`);

    const response = await fetchWithTimeout(llmsTxtUrl, 5000);

    if (response.ok) {
      const content = await response.text();
      if (content && content.length > 50) {
        console.log(`[URLProcessor] Found llms.txt (${content.length} chars)`);
        return content;
      }
    }
  } catch {
    // llms.txt not available, continue with normal fetch
  }

  return null;
}

export interface ProcessedUrl {
  content: string;
  sourceUrl: string;
  usedLlmsTxt: boolean;
}

/**
 * Process a URL and extract its content
 * Prioritizes llms.txt if available
 */
export async function processUrl(url: string): Promise<ProcessedUrl> {
  if (!isUrlSafe(url)) {
    throw new Error('URL is not allowed (internal/private addresses blocked)');
  }

  // Try llms.txt first
  const llmsTxtContent = await fetchLlmsTxt(url);
  if (llmsTxtContent) {
    return {
      content: llmsTxtContent.slice(0, MAX_CONTENT_LENGTH),
      sourceUrl: url,
      usedLlmsTxt: true,
    };
  }

  // Fallback to fetching the actual URL
  console.log(`[URLProcessor] Fetching ${url}`);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let content = await response.text();

  // If HTML, strip tags
  if (contentType.includes('text/html')) {
    content = stripHtml(content);
  }

  // Truncate to max length
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
  }

  return {
    content,
    sourceUrl: url,
    usedLlmsTxt: false,
  };
}

/**
 * Check if input is a valid URL
 */
export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Process raw text input (non-URL)
 */
export function processText(text: string): string {
  // Clean up and truncate
  let cleaned = text.trim();

  if (cleaned.length > MAX_CONTENT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
  }

  return cleaned;
}
