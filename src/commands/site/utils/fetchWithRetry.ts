/**
 * Fetches text content from a URL with exponential backoff retry on 429 (Too Many Requests).
 * Non-429 errors are thrown immediately without retrying.
 *
 * @param url - The URL to fetch
 * @param maxRetries - Maximum number of retries (default: 4, so 5 total attempts)
 * @param maxBackoffMs - Maximum backoff delay in ms (default: 8000)
 * @returns The response body as text
 */
export async function fetchWithRetry(
  url: string,
  maxRetries = 4,
  maxBackoffMs = 8000,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url);

    if (response.ok) {
      return await response.text();
    }

    if (response.status === 429 && attempt < maxRetries) {
      const backoff = Math.min(1000 * 2 ** attempt, maxBackoffMs);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }

  throw new Error(`Failed to fetch content after ${maxRetries + 1} attempts`);
}
