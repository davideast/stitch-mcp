export async function fetchWithRetry(url: string, retries = 5, backoff = 1000): Promise<string> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(`Too Many Requests (429)`);
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.text();
    } catch (e: any) {
      lastError = e;
      if (e.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
