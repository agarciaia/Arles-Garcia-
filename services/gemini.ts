import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
// IMPORTANT: process.env.API_KEY is automatically injected.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

export const generateChatResponse = async (
  history: { role: string; content: string }[],
  message: string,
  useThinking: boolean = false
) => {
  try {
    const modelName = 'gemini-3-pro-preview';
    
    // Configure thinking budget if requested
    const thinkingConfig = useThinking 
      ? { thinkingBudget: 32768 } 
      : undefined;

    const chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: "Eres un asistente experto en mecánica automotriz para una aplicación de gestión de talleres. Ayudas con diagnósticos complejos, recomendaciones de reparación y consejos de gestión. Sé conciso y profesional.",
        thinkingConfig: thinkingConfig,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      }))
    });

    const response = await chat.sendMessage({ message });
    return {
      text: response.text,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};

export const searchNearbyPlaces = async (query: string, userLocation?: { lat: number; lng: number }) => {
  try {
    const modelName = 'gemini-2.5-flash';
    
    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (userLocation) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userLocation.lat,
            longitude: userLocation.lng
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Find places related to: ${query}. List them clearly.`,
      config: config
    });

    return {
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error) {
    console.error("Gemini Maps Error:", error);
    throw error;
  }
};

export const analyzeServiceNotes = async (notes: string) => {
  try {
    // Quick analysis using Flash
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza estas notas de un mecánico y extrae una lista JSON de posibles repuestos necesarios:\n\n${notes}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            summary: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { parts: [], summary: "Error analyzing notes." };
  }
};
