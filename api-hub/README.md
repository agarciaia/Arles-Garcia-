# Arles API Hub

Capa reutilizable para conectar las APIs priorizadas para tus proyectos de QR, Presencia Digital, Gestión Taller, QR Huésped, prospección y automatización.

## Qué incluye

Los 10 grupos prioritarios están representados con adaptadores reutilizables:

1. **Links/QR:** Bitly + ClickMeter
2. **Mapas:** Geoapify + Mapbox
3. **Capturas web:** ApiFlash + Screenshotlayer
4. **Imágenes:** APITemplate.io + PhotoRoom + Tinify
5. **PDF:** CraftMyPDF + BuildPDF
6. **Vehículos:** CarVector
7. **Validación:** Numverify + Mailboxlayer
8. **Redes sociales:** Ayrshare + PostLake
9. **Turismo/eventos/clima:** Open-Meteo + Ticketmaster + Eventbrite + Tripadvisor Terra
10. **IA:** Gemini

> Importante: GitHub no debe almacenar las claves reales. Este repositorio solo contiene el código y los nombres de variables. Las claves se agregan luego en variables de entorno (por ejemplo, Vercel Environment Variables).

## Instalación local

```bash
cd api-hub
npm install
npm run check
```

Node.js 20+.

## Activar APIs

Copia `.env.example` a `.env` en tu entorno local o crea las mismas variables en Vercel. No subas `.env` a GitHub.

**Open-Meteo funciona sin clave.** Las demás funciones exigen la cuenta/clave correspondiente o, en algunos servicios, una licencia/plan.

## Uso rápido

```ts
import { openMeteoForecast, bitlyShorten, geoapifyGeocode, geminiGenerate } from './src/index.js';

const weather = await openMeteoForecast(-33.52, -70.69);
const address = await geoapifyGeocode('Lo Espejo, Santiago, Chile');
const short = await bitlyShorten('https://mi-demo.cl/cliente');
const analysis = await geminiGenerate('Analiza este negocio y su presencia digital.');
```

## Automatización

`src/workflows.ts` contiene ejemplos de composición. `buildProspectPack()` combina geocodificación, captura web, enlace corto e IA. Eso permite dispararlo desde una ruta API, un formulario, una tarea programada, Vercel, n8n/Make o desde otra app.

## Estado de los adaptadores

- **ready:** funciona sin credencial externa (actualmente Open-Meteo).
- **ready-needs-key:** integración lista; falta colocar tu clave/autorizar la cuenta.
- **configurable:** estructura lista, pero el endpoint se deja en variable de entorno porque el proveedor/plan puede cambiar su base URL o contrato.

Consulta `src/registry.ts` para ver el estado de cada proveedor.

## Seguridad

- No incrustes secretos en HTML ni frontend público.
- Llama APIs con claves desde backend/serverless.
- En Vercel guarda las claves en **Project → Settings → Environment Variables**.
- Aplica límites de uso, logs y manejo de errores antes de automatizaciones masivas.

## Nota sobre Eventbrite

La búsqueda pública general de eventos de Eventbrite está deprecada desde 2019. El adaptador incluido consulta eventos por ID; para descubrimiento general usa Ticketmaster, que sí mantiene Discovery API.
