import { auth } from '../firebase';
import { Service, Quote } from '../types';
import { normalizeWorkshopIntake, ServiceAnalysis, WorkshopIntakeDraft } from './aiData';

interface ApiErrorPayload {
  message?: string;
  code?: string;
}

export interface AiStatus {
  aiConfigured: boolean;
  voiceConfigured: boolean;
  vinConfigured: boolean;
  configuredProviders: string[];
}

export type CustomerMessageType = 'reception' | 'quote_ready' | 'completed' | 'balance_due';

const getToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para usar el asistente IA.');
  return user.getIdToken();
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({})) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new Error(data.message || 'El asistente IA no está disponible en este momento.');
  }
  return data;
};

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const token = await getToken();
  return parseResponse<T>(await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }));
};

export const getAiStatus = async (): Promise<AiStatus> => {
  const token = await getToken();
  return parseResponse<AiStatus>(await fetch('/api/ai/status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }));
};

export const generateChatResponse = async (
  history: { role: string; content: string }[],
  message: string,
  useThinking = false,
) => postJson<{ text: string; provider?: string; model?: string }>('/api/ai/chat', {
  history,
  message,
  useThinking,
});

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(new Error('No fue posible preparar el audio.'));
  reader.readAsDataURL(blob);
});

const extensionForMime = (mimeType: string) => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
};

export const transcribeAudio = async (audio: Blob) => {
  if (audio.size > 3_000_000) {
    throw new Error('La grabación es demasiado larga. Intenta una nota de voz más breve.');
  }
  const mimeType = audio.type || 'audio/webm';
  return postJson<{ text: string }>('/api/ai/transcribe', {
    audioBase64: await blobToBase64(audio),
    mimeType,
    filename: `orden-voz.${extensionForMime(mimeType)}`,
  });
};

export const buildWorkshopIntake = async (transcript: string): Promise<{ draft: WorkshopIntakeDraft; transcript: string }> => {
  const response = await postJson<{ draft: unknown; transcript: string }>('/api/ai/workshop-intake', { transcript });
  return { draft: normalizeWorkshopIntake(response.draft), transcript: response.transcript || transcript };
};

export const analyzeService = async (service: Service | null, notes = '') => {
  const response = await postJson<{ analysis: ServiceAnalysis }>('/api/ai/analyze-service', { service, notes });
  return response.analysis;
};

export const generateCustomerMessage = async (
  contextType: 'service' | 'quote',
  messageType: CustomerMessageType,
  data: Record<string, unknown>,
) => postJson<{ text: string }>('/api/ai/customer-message', { contextType, messageType, data });

export const lookupVin = async (vin: string) => postJson<{
  vehicle: Partial<Pick<Service, 'brand' | 'model' | 'year' | 'mileage'>>;
  fieldsFound: string[];
}>('/api/vehicle/vin', { vin });

export const serviceMessageContext = (service: Service, companyName: string, total: number, paid: number, balance: number) => ({
  id: service.id,
  clientName: service.clientName,
  phone: service.phone || '',
  plate: service.plate,
  brand: service.brand,
  model: service.model,
  reason: service.reason,
  status: service.status,
  total,
  paid,
  balance,
  companyName,
  laborItems: service.laborItems || [],
  expenses: service.expenses || [],
});

export const quoteMessageContext = (quote: Quote, companyName: string) => ({
  id: quote.id,
  clientName: quote.clientName,
  phone: quote.phone || '',
  vehicle: quote.vehicle,
  notes: quote.notes || '',
  status: quote.status || 'pending',
  total: quote.total,
  companyName,
  laborItems: quote.laborItems || [],
  expenses: quote.expenseItems || quote.items || [],
});
