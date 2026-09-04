let fallbackCounter = 0;

export const createId = (): string => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackCounter += 1;
  return `${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
};
