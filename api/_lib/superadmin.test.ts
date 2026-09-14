import { describe, expect, it } from 'vitest';
import { passwordHash, passwordMatches } from './superadmin.mjs';

describe('credenciales de superadministración', () => {
  it('guarda un hash con sal y nunca la clave original', () => {
    const password = 'ClaveSegura123';
    const record = passwordHash(password);
    expect(record.hash).not.toContain(password);
    expect(record.salt).not.toContain(password);
    expect(passwordMatches(password, record)).toBe(true);
    expect(passwordMatches('ClaveIncorrecta123', record)).toBe(false);
  });
});
