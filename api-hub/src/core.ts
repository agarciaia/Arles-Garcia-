export class ApiHubError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly provider?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiHubError';
  }
}

export function env(name: string): string {
  const value = (globalThis as any).process?.env?.[name] as string | undefined;
  if (!value) throw new ApiHubError(`Missing environment variable: ${name}`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return ((globalThis as any).process?.env?.[name] as string | undefined) || undefined;
}

export async function jsonFetch<T>(
  provider: string,
  input: string | URL,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    throw new ApiHubError(
      `${provider} request failed (${response.status})`,
      response.status,
      provider,
      body,
    );
  }
  return body as T;
}

export async function binaryFetch(
  provider: string,
  input: string | URL,
  init: RequestInit = {},
): Promise<ArrayBuffer> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiHubError(
      `${provider} request failed (${response.status})`,
      response.status,
      provider,
      text,
    );
  }
  return response.arrayBuffer();
}

export function withQuery(base: string, params: Record<string, string | number | boolean | undefined>): URL {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}
