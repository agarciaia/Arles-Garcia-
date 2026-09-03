interface ApiResponse {
  text?: string;
  groundingMetadata?: unknown;
  groundingChunks?: unknown;
  parts?: string[];
  summary?: string;
}

const postToProtectedApi = async (path: string, body: unknown): Promise<ApiResponse> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('El asistente de IA no está disponible en este momento.');
  }
  return response.json();
};

// Las claves privadas nunca se incluyen en el navegador. Estas funciones usan
// endpoints protegidos que deben configurarse durante el despliegue.
export const generateChatResponse = async (
  history: { role: string; content: string }[],
  message: string,
  useThinking: boolean = false,
) => postToProtectedApi('/api/gemini/chat', { history, message, useThinking });

export const searchNearbyPlaces = async (
  query: string,
  userLocation?: { lat: number; lng: number },
) => postToProtectedApi('/api/gemini/places', { query, userLocation });

export const analyzeServiceNotes = async (notes: string) => {
  try {
    return await postToProtectedApi('/api/gemini/analyze-service', { notes });
  } catch {
    return { parts: [], summary: 'No fue posible analizar las notas.' };
  }
};
