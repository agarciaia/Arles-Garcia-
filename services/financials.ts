import { Quote, Service } from '../types';

const safeAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

export const calculateServiceRawLabor = (service: Partial<Service>): number => {
  const items = service.laborItems || [];
  if (items.length === 0) return safeAmount(service.price);
  return items.reduce((total, item) => total + safeAmount(item.amount), 0);
};

export const calculateLaborDiscount = (
  rawLabor: number,
  discount: unknown,
  type: 'percent' | 'fixed' | undefined,
): number => {
  const normalizedLabor = Math.max(0, rawLabor);
  const normalizedDiscount = safeAmount(discount);
  const requested = type === 'fixed'
    ? normalizedDiscount
    : Math.round(normalizedLabor * (Math.min(normalizedDiscount, 100) / 100));

  return Math.min(requested, normalizedLabor);
};

export const calculateServiceTotal = (service: Partial<Service>): number => {
  const rawLabor = calculateServiceRawLabor(service);
  const discount = calculateLaborDiscount(rawLabor, service.laborDiscount, service.laborDiscountType);
  const expenses = (service.expenses || []).reduce(
    (total, item) => total + safeAmount(item.amount),
    0,
  );
  return Math.max(0, rawLabor - discount + expenses);
};

export const calculateServicePaid = (service: Partial<Service>): number => {
  if (service.payments && service.payments.length > 0) {
    return service.payments.reduce((total, payment) => total + safeAmount(payment.amount), 0);
  }
  return safeAmount(service.advance);
};

export const calculateServiceBalance = (service: Partial<Service>): number =>
  Math.max(0, calculateServiceTotal(service) - calculateServicePaid(service));

export const calculateQuoteRawLabor = (quote: Partial<Quote>): number =>
  (quote.laborItems || []).reduce(
    (total, item) => total + safeAmount(item.unitPrice) * safeAmount(item.quantity),
    0,
  );

export const calculateQuoteTotal = (quote: Partial<Quote>): number => {
  const rawLabor = calculateQuoteRawLabor(quote);
  const discount = calculateLaborDiscount(rawLabor, quote.laborDiscount, quote.laborDiscountType);
  const expenseItems = quote.expenseItems?.length ? quote.expenseItems : (quote.items || []);
  const expenses = expenseItems.reduce(
    (total, item) => total + safeAmount(item.unitPrice) * safeAmount(item.quantity),
    0,
  );
  return Math.max(0, rawLabor - discount + expenses);
};
