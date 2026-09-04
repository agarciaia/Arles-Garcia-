import { describe, expect, it } from 'vitest';
import { getEffectiveAccountStatus } from './cloudData';
import { AccountInfo } from '../types';

const base: AccountInfo = {
  uid: 'workshop-1',
  email: 'owner@example.com',
  plan: 'trial',
  status: 'trialing',
  onboardingCompleted: true,
};

describe('estado efectivo de la cuenta', () => {
  it('mantiene activa una prueba que todavía no vence', () => {
    const account = { ...base, trialEndsAt: '2026-09-20T00:00:00.000Z' };
    expect(getEffectiveAccountStatus(account, new Date('2026-09-10T00:00:00.000Z'))).toBe('trialing');
  });

  it('pasa una prueba vencida a modo lectura', () => {
    const account = { ...base, trialEndsAt: '2026-09-09T23:59:59.000Z' };
    expect(getEffectiveAccountStatus(account, new Date('2026-09-10T00:00:00.000Z'))).toBe('expired');
  });

  it('mantiene activo el Plan Fundador pagado', () => {
    const account: AccountInfo = { ...base, plan: 'founder', status: 'active', paidThrough: '2026-10-10T00:00:00.000Z' };
    expect(getEffectiveAccountStatus(account, new Date('2026-09-10T00:00:00.000Z'))).toBe('active');
  });

  it('vence el Plan Fundador cuando no existe una fecha pagada vigente', () => {
    const account: AccountInfo = { ...base, plan: 'founder', status: 'active', paidThrough: '2026-09-01T00:00:00.000Z' };
    expect(getEffectiveAccountStatus(account, new Date('2026-09-10T00:00:00.000Z'))).toBe('expired');
  });
});
