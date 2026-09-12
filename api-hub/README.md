# API Hub — Arles

Capa central de integraciones para reutilizar APIs en distintos proyectos sin exponer claves en el frontend.

## Grupos instalados

1. **Enlaces/QR:** Bitly, ClickMeter
2. **Mapas y ubicación:** Geoapify, Mapbox
3. **Capturas web:** Screenshotlayer, ApiFlash
4. **Imágenes:** APITemplate.io, PhotoRoom, Tinify
5. **PDF:** CraftMyPDF, BuildPDF
6. **Vehículos:** CarVector
7. **Validación de contactos:** Numverify, Mailboxlayer
8. **Redes sociales:** Ayrshare, PostLake
9. **Turismo/huésped:** Open-Meteo, Ticketmaster, Eventbrite y Tripadvisor
10. **IA multi-proveedor:** Gemini, OpenRouter, Groq, NVIDIA NIM, Mistral, Hugging Face, Vercel AI Gateway, Cerebras, Cohere y Cloudflare Workers AI

## Router automático de IA

`src/llm-router.mjs` unifica los proveedores de IA y permite cambiar de proveedor sin reescribir la aplicación.

Funciones principales:

- `chatWithProvider(provider, input)`: fuerza un proveedor concreto.
- `chatAuto(input)`: prueba automáticamente los proveedores configurados hasta obtener respuesta.
- `activeLlmProviders()`: muestra qué proveedores están listos y qué modelo usarán.
- `transcribeWithGroq(audioBlob)`: convierte audio a texto con Whisper en Groq.

Orden de fallback inicial:

`OpenRouter -> Groq -> Cerebras -> Mistral -> Gemini -> Hugging Face -> NVIDIA -> Cohere -> Vercel AI Gateway -> Cloudflare`

OpenRouter usa por defecto `openrouter/free`, pensado para pruebas, demos y cargas pequeñas sin coste por tokens. Para producción conviene configurar proveedores/modelos con límites y presupuesto controlados.

### Ejemplo

```js
import { chatAuto, transcribeWithGroq } from './src/index.mjs';

const respuesta = await chatAuto({
  system: 'Eres un analista comercial.',
  prompt: 'Analiza este negocio y propone una oferta breve.'
});

console.log(respuesta.provider, respuesta.model, respuesta.text);
```

Si OpenRouter no está configurado o falla, `chatAuto()` intenta el siguiente proveedor activo sin que la app tenga que saber cuál es.

## Estado real

- **Open-Meteo:** funciona sin API key.
- **APIs de IA:** el código está listo; cada proveedor requiere su propia credencial salvo mecanismos específicos de plataforma.
- **GitHub Models no está integrado:** GitHub retiró ese servicio de inferencia en 2026. GitHub Copilot es un producto distinto.
- Eventbrite está incluido solo para operaciones actualmente soportadas por su API.
- Las claves nunca deben guardarse en GitHub. Usa `.env.local` en desarrollo y variables de entorno en Vercel.

## Uso automático en tus proyectos

### Prospección QR

Dirección/web -> geocodificación -> validar teléfono/correo -> captura del sitio -> enlace corto -> `chatAuto()` genera análisis comercial y mensaje personalizado.

### Gestión Taller

Audio del mecánico -> Groq Whisper -> texto -> `chatAuto()` estructura cliente, vehículo, trabajo solicitado, repuestos y observaciones.

### QR Huésped

Ubicación -> clima + eventos + lugares -> IA redacta recomendaciones para el huésped.

### Marketing

Datos del negocio -> IA genera contenido -> Ayrshare/PostLake publica o programa en redes.

## Activación

1. Copia `.env.example` a `.env.local` para desarrollo o crea las mismas variables en Vercel.
2. Obtén únicamente las claves de los proveedores que quieras utilizar.
3. Ejecuta `npm run check` dentro de `api-hub` para revisar estado.
4. Importa desde `src/index.mjs`.
5. Ejecuta todo lo que use secretos desde backend/serverless, nunca desde HTML público.

No necesitas activar todos los proveedores. El router ignora automáticamente los que no tengan credenciales.
