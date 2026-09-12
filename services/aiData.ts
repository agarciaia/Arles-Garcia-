import { Service } from '../types';

export interface AiLineItem {
  description: string;
  amount: number;
}

export interface WorkshopIntakeDraft {
  clientName: string;
  phone: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  vin: string;
  mileage: number | null;
  reason: string;
  laborItems: AiLineItem[];
  expenses: AiLineItem[];
  observations: string;
  confidenceNotes: string[];
}

export interface ServiceAnalysis {
  summary: string;
  detectedWork: string[];
  mentionedParts: string[];
  missingInformation: string[];
  suggestedQuestions: string[];
  customerMessage: string;
  disclaimer: string;
}

export const emptyWorkshopIntake = (): WorkshopIntakeDraft => ({
  clientName: '',
  phone: '',
  plate: '',
  brand: '',
  model: '',
  year: null,
  vin: '',
  mileage: null,
  reason: '',
  laborItems: [],
  expenses: [],
  observations: '',
  confidenceNotes: [],
});

const optionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
};

const text = (value: unknown, max = 3000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const items = (value: unknown): AiLineItem[] => Array.isArray(value)
  ? value.slice(0, 30).map((item) => ({
      description: text(item?.description, 300),
      amount: Math.max(0, optionalNumber(item?.amount) || 0),
    })).filter((item) => item.description)
  : [];

export function normalizeWorkshopIntake(value: unknown): WorkshopIntakeDraft {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const year = optionalNumber(raw.year);
  const maxYear = new Date().getFullYear() + 2;
  return {
    clientName: text(raw.clientName, 200),
    phone: text(raw.phone, 80),
    plate: text(raw.plate, 30).toUpperCase(),
    brand: text(raw.brand, 100),
    model: text(raw.model, 120),
    year: year && year >= 1886 && year <= maxYear ? year : null,
    vin: text(raw.vin, 40).toUpperCase(),
    mileage: optionalNumber(raw.mileage),
    reason: text(raw.reason, 2000),
    laborItems: items(raw.laborItems),
    expenses: items(raw.expenses),
    observations: text(raw.observations, 3000),
    confidenceNotes: Array.isArray(raw.confidenceNotes)
      ? raw.confidenceNotes.slice(0, 12).map((item) => text(item, 300)).filter(Boolean)
      : [],
  };
}

export function serviceFromIntake(draft: WorkshopIntakeDraft, id: string, entryDate = new Date().toISOString()): Service {
  const laborItems = draft.laborItems.map((item, index) => ({
    id: `${id}-labor-${index + 1}`,
    description: item.description,
    amount: Math.max(0, Math.round(item.amount || 0)),
  }));
  const expenses = draft.expenses.map((item, index) => ({
    id: `${id}-expense-${index + 1}`,
    description: item.description,
    amount: Math.max(0, Math.round(item.amount || 0)),
  }));
  return {
    id,
    clientName: draft.clientName,
    phone: draft.phone,
    plate: draft.plate,
    brand: draft.brand,
    model: draft.model,
    ...(draft.year ? { year: draft.year } : {}),
    ...(draft.vin ? { vin: draft.vin } : {}),
    ...(draft.mileage ? { mileage: draft.mileage } : {}),
    reason: draft.reason,
    ...(draft.observations ? { observations: draft.observations } : {}),
    laborItems,
    expenses,
    price: laborItems.reduce((sum, item) => sum + item.amount, 0),
    advance: 0,
    payments: [],
    photos: [],
    entryDate,
    status: 'pending',
  };
}

export function preserveServiceOptionalFields(previous: Service[], next: Service[]): Service[] {
  const previousById = new Map(previous.map((service) => [service.id, service]));
  return next.map((service) => {
    const old = previousById.get(service.id);
    if (!old) return service;
    return {
      ...service,
      year: service.year ?? old.year,
      vin: service.vin ?? old.vin,
      mileage: service.mileage ?? old.mileage,
      observations: service.observations ?? old.observations,
    };
  });
}
