import { describe, expect, it } from 'vitest';
import { normalizeWorkshopIntake, preserveServiceOptionalFields, serviceFromIntake } from './aiData';
import { Service } from '../types';

describe('AI workshop intake helpers', () => {
  it('normalizes an intake without inventing absent data', () => {
    const draft = normalizeWorkshopIntake({
      clientName: 'Ana',
      plate: 'abcd12',
      year: '2022',
      laborItems: [{ description: 'Cambio de aceite', amount: '25000' }],
    });
    expect(draft.clientName).toBe('Ana');
    expect(draft.plate).toBe('ABCD12');
    expect(draft.year).toBe(2022);
    expect(draft.vin).toBe('');
    expect(draft.mileage).toBeNull();
    expect(draft.laborItems).toEqual([{ description: 'Cambio de aceite', amount: 25000 }]);
  });

  it('creates a pending service only from a confirmed draft', () => {
    const draft = normalizeWorkshopIntake({
      clientName: 'Luis',
      phone: '+56911111111',
      plate: 'XXYY11',
      brand: 'Toyota',
      model: 'Yaris',
      vin: 'JTDBR32E720123456',
      mileage: 120000,
      reason: 'Mantención',
      laborItems: [{ description: 'Mantención', amount: 30000 }],
      expenses: [{ description: 'Aceite', amount: 20000 }],
    });
    const service = serviceFromIntake(draft, 'svc-1', '2026-09-12T12:00:00.000Z');
    expect(service.id).toBe('svc-1');
    expect(service.status).toBe('pending');
    expect(service.price).toBe(30000);
    expect(service.vin).toBe('JTDBR32E720123456');
    expect(service.expenses?.[0].amount).toBe(20000);
  });

  it('preserves optional vehicle fields when a legacy editor omits them', () => {
    const previous: Service = {
      id: '1', clientName: 'A', plate: 'AA11', brand: 'Kia', model: 'Rio', reason: 'R',
      year: 2020, vin: 'KNADM5A34L6123456', mileage: 80000, observations: 'Obs',
      price: 0, entryDate: '2026-01-01', status: 'pending',
    };
    const legacyEdit: Service = {
      id: '1', clientName: 'A Editado', plate: 'AA11', brand: 'Kia', model: 'Rio', reason: 'R',
      price: 0, entryDate: '2026-01-01', status: 'pending',
    };
    const [merged] = preserveServiceOptionalFields([previous], [legacyEdit]);
    expect(merged.clientName).toBe('A Editado');
    expect(merged.year).toBe(2020);
    expect(merged.vin).toBe('KNADM5A34L6123456');
    expect(merged.mileage).toBe(80000);
    expect(merged.observations).toBe('Obs');
  });
});
