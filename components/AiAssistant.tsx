import React, { useState, useRef, useEffect } from 'react';
import { generateChatResponse, searchNearbyPlaces } from '../services/gemini';
import { ChatMessage } from '../types';
import { Send, MapPin, Bot, User, Brain, Loader2, Navigation } from 'lucide-react';

const AiAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      content: 'Hola, soy tu asistente de taller. Puedo ayudarte a diagnosticar problemas, buscar repuestos cercanos o responder dudas mecánicas.',
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'maps'>('chat');
  const [useThinking, setUseThinking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (mode === 'maps') {
        await handleMapsQuery(userMsg.content);
      } else {
        await handleChatQuery(userMsg.content);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatQuery = async (query: string) => {
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const response = await generateChatResponse(history, query, useThinking);
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      content: response.text || "No response text received",
      groundingMetadata: response.groundingMetadata,
      isThinking: useThinking,
      timestamp: Date.now()
    }]);
  };

  const handleMapsQuery = async (query: string) => {
    let location: { lat: number; lng: number } | undefined;
    try {
       const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
       });
       location = {
         lat: position.coords.latitude,
         lng: position.coords.longitude
       };
    } catch (e) {
      console.warn("Geolocation not available or denied");
    }

    const response = await searchNearbyPlaces(query, location);
    let content = response.text || "Aquí tienes algunos lugares:";
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      content: content,
      groundingMetadata: { groundingChunks: response.groundingChunks },
      timestamp: Date.now()
    }]);
  };

  const renderMessageContent = (msg: ChatMessage) => {
    return (
      <div className="space-y-2">
        {msg.isThinking && (
          <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded w-fit mb-2">
            <Brain size={12} />
            <span>Pensamiento Profundo Activado</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.content}</div>
        
        {msg.groundingMetadata?.groundingChunks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 not-prose">
            {msg.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => {
              const mapData = chunk.web || chunk.maps;
              if (!mapData) return null;
              
              return (
                <a 
                  key={idx} 
                  href={mapData.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block bg-slate-800 border border-slate-700 hover:border-blue-500 p-3 rounded-lg transition-colors"
                >
                  <div className="font-bold text-blue-400 text-sm truncate">{mapData.title}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                     <MapPin size={10} /> Ver en mapa
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    // Height calculation adjusted for new header (100vh - header height - margins)
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-9rem)] flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Bot className="text-white" size={20} />
          </div>
          <div className="hidden sm:block">
            <h2 className="text-base font-bold text-white">Asistente IA</h2>
            <p className="text-[10px] text-slate-400">Powered by Gemini</p>
          </div>
        </div>

        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          <button 
            onClick={() => setMode('chat')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
              mode === 'chat' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot size={14} /> Chat
          </button>
          <button 
            onClick={() => setMode('maps')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
              mode === 'maps' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin size={14} /> Mapas
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-950/50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm md:text-base ${
              msg.role === 'user' 
                ? 'bg-slate-800 text-white rounded-tr-none' 
                : 'bg-blue-600/10 text-slate-100 rounded-tl-none border border-blue-500/20'
            }`}>
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
               <Bot size={16} />
             </div>
             <div className="bg-blue-600/10 text-slate-100 rounded-2xl rounded-tl-none border border-blue-500/20 p-4 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">
                  {mode === 'maps' ? 'Buscando lugares...' : useThinking ? 'Pensando...' : 'Escribiendo...'}
                </span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSend} className="relative">
          {mode === 'chat' && (
            <div className="absolute -top-8 left-0 flex items-center gap-2 px-1">
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white transition-colors">
                <div 
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useThinking ? 'bg-purple-600' : 'bg-slate-700'}`}
                  onClick={() => setUseThinking(!useThinking)}
                >
                  <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${useThinking ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className={useThinking ? 'text-purple-400 font-bold' : ''}>
                  Modo Pensamiento
                </span>
              </label>
            </div>
          )}
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              mode === 'maps' 
                ? "Buscar repuestos o talleres..." 
                : "Escribe tu consulta aquí..."
            }
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3.5 text-sm md:text-base text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            {mode === 'maps' ? <Navigation size={18} /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistant;