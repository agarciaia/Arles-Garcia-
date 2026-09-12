import { analyzeService, generateChatResponse as generateAiChatResponse } from './ai';

interface ApiResponse {
  text?: string;
  groundingMetadata?: unknown;
  groundingChunks?: unknown[];
  parts?: string[];
  summary?: string;
  detectedWork?: string[];
  mentionedParts?: string[];
  missingInformation?: string[];
  suggestedQuestions?: string[];
  customerMessage?: string;
  disclaimer?: string;
}

// Compatibilidad: se conserva el módulo y las firmas antiguas, pero las llamadas
// ya no dependen de Gemini ni exponen claves en el navegador.
export const generateChatResponse = async (
  history: { role: string; content: string }[],
  message: string,
  useThinking: boolean = false,
): Promise<ApiResponse> => generateAiChatResponse(history, message, useThinking);

export const searchNearbyPlaces = async (
  query: string,
  userLocation?: { lat: number; lng: number },
): Promise<ApiResponse> => {
  const locationText = userLocation
    ? `Ubicación aproximada entregada por el navegador: lat ${userLocation.lat}, lng ${userLocation.lng}. `
    : '';
  const response = await generateAiChatResponse([], `${locationText}Ayúdame con esta búsqueda relacionada con el taller: ${query}. Si no tienes datos actuales o verificables de lugares, dilo claramente y no inventes negocios, direcciones ni horarios.`, false);
  return { ...response, groundingChunks: [] };
};

export const analyzeServiceNotes = async (notes: string): Promise<ApiResponse> => {
  try {
    const analysis = await analyzeService(null, notes);
    return {
      parts: analysis.detectedWork,
      summary: analysis.summary,
      detectedWork: analysis.detectedWork,
      mentionedParts: analysis.mentionedParts,
      missingInformation: analysis.missingInformation,
      suggestedQuestions: analysis.suggestedQuestions,
      customerMessage: analysis.customerMessage,
      disclaimer: analysis.disclaimer,
    };
  } catch {
    return { parts: [], summary: 'No fue posible analizar las notas.' };
  }
};
