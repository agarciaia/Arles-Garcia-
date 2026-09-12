import { afterEach, describe, expect, it } from 'vitest';
import { providerStatus } from './providers.mjs';

const originalApiKey = process.env.AI_GATEWAY_API_KEY;
const originalOidc = process.env.VERCEL_OIDC_TOKEN;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalApiKey;

  if (originalOidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
  else process.env.VERCEL_OIDC_TOKEN = originalOidc;
});

describe('Vercel AI Gateway readiness', () => {
  it('is configured with the automatic Vercel OIDC token', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = 'test-oidc-token';
    expect(providerStatus('vercelai').configured).toBe(true);
  });

  it('is configured with an explicit AI Gateway API key', () => {
    delete process.env.VERCEL_OIDC_TOKEN;
    process.env.AI_GATEWAY_API_KEY = 'test-api-key';
    expect(providerStatus('vercelai').configured).toBe(true);
  });

  it('is unavailable when neither authentication method exists', () => {
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.AI_GATEWAY_API_KEY;
    expect(providerStatus('vercelai').configured).toBe(false);
  });
});
