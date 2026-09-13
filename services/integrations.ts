import { auth } from '../firebase';

interface ApiErrorPayload {
  message?: string;
}

export interface WorkshopIntegrationStatus {
  ai: boolean;
  voice: boolean;
  vin: boolean;
  phoneValidation: boolean;
  imageOptimization: boolean;
  cloudPdf: boolean;
  configuredLlmProviders: string[];
}

export interface PhoneValidationResult {
  valid: boolean;
  number: string;
  localFormat: string | null;
  internationalFormat: string | null;
  countryName: string | null;
  carrier: string | null;
  lineType: string | null;
}

const token = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para usar las integraciones del taller.');
  return user.getIdToken();
};

const parse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({})) as T & ApiErrorPayload;
  if (!response.ok) throw new Error(data.message || 'No fue posible completar la consulta.');
  return data;
};

export const getWorkshopIntegrationStatus = async (): Promise<WorkshopIntegrationStatus> => {
  const idToken = await token();
  return parse<WorkshopIntegrationStatus>(await fetch('/api/integrations/status', {
    headers: { Authorization: `Bearer ${idToken}` },
  }));
};

export const validateWorkshopPhone = async (phone: string): Promise<PhoneValidationResult> => {
  const idToken = await token();
  return parse<PhoneValidationResult>(await fetch('/api/contact/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ phone }),
  }));
};
