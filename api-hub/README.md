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
10. **IA:** Gemini API

En total hay **21 proveedores** registrados dentro de los 10 grupos prioritarios.

## Estado real

- **Open-Meteo:** listo para usarse inmediatamente; no requiere API key.
- **Los demás proveedores:** código/configuración preparados, pero requieren la clave/token de tu propia cuenta antes de llamadas reales.
- Eventbrite está incluido para consultas permitidas por su API (por ejemplo, eventos por ID); su antigua búsqueda pública general no se trata como disponible.
- Algunos proveedores con endpoint variable según plan permiten sobrescribir su `BASE_URL` mediante variables de entorno.
- Las claves **nunca deben guardarse en GitHub**. Usa `.env.local` en desarrollo y `Environment Variables` en Vercel.

## Archivos

- `.env.example`: variables necesarias, sin secretos.
- `src/providers.mjs`: registro de proveedores y estado de configuración.
- `src/api-hub.mjs`: funciones reutilizables de las APIs.
- `src/workflows.mjs`: automatizaciones que combinan varias APIs.
- `src/check-config.mjs`: muestra cuáles están activadas y cuáles esperan credenciales.

## Uso rápido

```js
import {
  getWeather,
  geocodeWithGeoapify,
  shortenWithBitly,
  validatePhone,
  publishWithAyrshare,
  askGemini
} from './src/api-hub.mjs';

const clima = await getWeather({ latitude: -33.52, longitude: -70.69 });
const lugar = await geocodeWithGeoapify('Talca, Chile');
const corto = await shortenWithBitly('https://ejemplo.cl/menu');
const telefono = await validatePhone('987654321', 'CL');

await publishWithAyrshare({
  post: 'Nueva publicación',
  platforms: ['instagram', 'facebook']
});

const ia = await askGemini('Analiza este negocio y propone una oferta comercial.');
```

## Uso automático

Sí. No necesitas usar cada API manualmente. `src/workflows.mjs` incluye dos flujos iniciales:

### `buildProspectPack()`

Pensado para tu prospección QR. Puede combinar, según las claves activadas:

- geocodificación del negocio;
- validación de teléfono;
- validación de correo;
- enlace corto de la demo;
- URL de captura del sitio;
- análisis comercial con Gemini.

### `buildGuestPack()`

Pensado para QR Huésped:

- clima actual/pronóstico;
- eventos cercanos;
- lugares turísticos/restaurantes/hoteles.

Además puedes automatizar:

- al crear un cliente QR → generar enlace corto y medir clics;
- al guardar una cotización → generar PDF;
- al cargar una imagen → quitar fondo y comprimirla;
- en Gestión Taller → consultar información vehicular mediante el proveedor configurado;
- en marketing → generar contenido con Gemini y enviarlo a Ayrshare/PostLake;
- en una tarea programada de Vercel → actualizar clima, eventos o datos periódicamente.

## Activación

1. Obtén las claves de los proveedores que quieras utilizar.
2. Copia `.env.example` a `.env.local` o crea esas variables en Vercel.
3. Ejecuta `npm run check` dentro de `api-hub` para saber qué proveedores están activos.
4. Llama las funciones desde backend/serverless, no desde HTML público.

No es necesario activar las 21 APIs a la vez. Puedes activar solo las que use cada proyecto.

## Seguridad

Nunca expongas claves secretas en HTML o JavaScript del navegador. En producción, las funciones que requieren claves deben ejecutarse desde backend/serverless (por ejemplo, Vercel Functions) y devolver al frontend únicamente los datos necesarios.
