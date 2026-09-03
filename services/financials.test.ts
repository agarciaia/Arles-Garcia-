import { describe, expect, it } from 'vitest';
import {
  calculateQuoteTotal,
  calculateServiceBalance,
  calculateServicePaid,
  calculateServiceTotal,
} from './financials';

describe('financial calculations', () => {
  it('applies percentage discount only to labor', () => {
    const total = calculateServiceTotal({
      price: 0,
      laborItems: [{ id: 'l1', description: 'Trabajo', amount: 100_000 }],
      expenses: [{ id: 'e1', description: 'Repuesto', amount: 50_000 }],
      laborDiscount: 10,
      laborDiscountType: 'percent',
    });
    expect(total).toBe(140_000);
  });

  it('caps a fixed discount at the labor amount', () => {
    const total = calculateServiceTotal({
      price: 50_000,
      expenses: [{ id: 'e1', description: 'Repuesto', amount: 20_000 }],
      laborDiscount: 80_000,
      laborDiscountType: 'fixed',
    });
    expect(total).toBe(20_000);
  });

  it('sums every registered payment and never returns a negative balance', () => {
    const service = {
      price: 100_000,
      payments: [
        { id: 'p1', amount: 30_000, date: '2026-09-01', type: 'advance' as const, description: 'Abono' },
        { id: 'p2', amount: 70_000, date: '2026-09-02', type: 'final' as const, description: 'Pago final' },
      ],
    };
    expect(calculateServicePaid(service)).toBe(100_000);
    expect(calculateServiceBalance(service)).toBe(0);
  });

  it('uses the legacy advance only when there is no payment ledger', () => {
    expect(calculateServicePaid({ price: 80_000, advance: 25_000 })).toBe(25_000);
  });

  it('calculates quote quantities, parts and labor discount consistently', () => {
    expect(calculateQuoteTotal({
      laborItems: [{ id: 'l1', description: 'Trabajo', quantity: 2, unitPrice: 30_000 }],
      expenseItems: [{ id: 'e1', description: 'Repuesto', quantity: 3, unitPrice: 10_000 }],
      laborDiscount: 10_000,
      laborDiscountType: 'fixed',
    })).toBe(80_000);
  });
});
