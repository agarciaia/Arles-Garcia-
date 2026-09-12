import { cleanNumber, cleanString } from './http.mjs';

export const WORKSHOP_SYSTEM = 'Eres un asistente para un taller mecánico. Ayudas a organizar información administrativa y técnica. Nunca presentes un diagnóstico mecánico como certeza. Distingue hechos informados de sugerencias. No inventes datos, precios, VIN, patentes, kilometraje, repuestos ni trabajos.';

function optionalPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = cleanNumber(value);
  return number > 0 ? Math.round(number) : null;
}

function normalizeItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item) => ({
    description: cleanString(item?.description, 300),
    amount: Math.max(0, Math.round(cleanNumber(item?.amount))),
  })).filter((item) => item.description);
}

export function normalizeWorkshopIntake(value = {}) {
  const year = optionalPositiveNumber(value.year);
  return {
    clientName: cleanString(value.clientName, 200),
    phone: cleanString(value.phone, 80),
    plate: cleanString(value.plate, 30).toUpperCase(),
    brand: cleanString(value.brand, 100),
    model: cleanString(value.model, 120),
    year: year && year >= 1886 && year <= new Date().getFullYear() + 2 ? year : null,
    vin: cleanString(value.vin, 40).toUpperCase(),
    mileage: optionalPositiveNumber(value.mileage),
    reason: cleanString(value.reason, 2000),
    laborItems: normalizeItems(value.laborItems),
    expenses: normalizeItems(value.expenses),
    observations: cleanString(value.observations, 3000),
    confidenceNotes: Array.isArray(value.confidenceNotes)
      ? value.confidenceNotes.slice(0, 12).map((x) => cleanString(x, 300)).filter(Boolean)
      : [],
  };
}

export function normalizeServiceAnalysis(value = {}) {
  const list = (key) => Array.isArray(value[key])
    ? value[key].slice(0, 20).map((x) => cleanString(x, 500)).filter(Boolean)
    : [];
  return {
    summary: cleanString(value.summary, 2000),
    detectedWork: list('detectedWork'),
    mentionedParts: list('mentionedParts'),
    missingInformation: list('missingInformation'),
    suggestedQuestions: list('suggestedQuestions'),
    customerMessage: cleanString(value.customerMessage, 1600),
    disclaimer: cleanString(value.disclaimer, 800) || 'Sugerencia del asistente: confirma la información y el diagnóstico con una revisión mecánica.',
  };
}
