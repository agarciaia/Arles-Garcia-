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
9. **Turismo/huésped:** Open-Meteo, Ticketmaster, Tripadvisor
10. **IA:** Gemini API

## Estado real

- **Open-Meteo:** listo para usarse inmediatamente; no requiere API key.
- **Los demás proveedores:** código y configuración preparados, pero requieren que agregues la clave/token de tu propia cuenta antes de poder hacer llamadas reales.
- Las claves **no deben guardarse en GitHub**. Usa `.env.local` en desarrollo y `Environment Variables` en Vercel.

## Archivos

- `.env.example`: nombres de todas las variables necesarias.
- `src/providers.mjs`: registro central de proveedores.
- `src/api-hub.mjs`: funciones listas y cliente genérico.
- `src/check-config.mjs`: muestra cuáles están activadas y cuáles esperan credenciales.

## Ejemplos

```js
import {
  getWeather,
  geocodeWithGeoapify,
  shortenWithBitly,
  validatePhone,
  publishWithAyrshare,
  askGemini
} from './src/api-hub.mjs';

const clima = await getWeather({
  latitude: -33.52,
  longitude: -70.69
});

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

Sí. Una app puede llamar estas funciones sin intervención manual. Ejemplos:

- Al crear un prospecto: geocodificar dirección + validar teléfono/email + sacar captura del sitio.
- Al crear un cliente QR: generar enlace corto y medir clics.
- En QR Huésped: consultar clima, eventos y lugares cercanos automáticamente.
- En Gestión Taller: consultar información vehicular cuando exista una patente/VIN compatible con el proveedor.
- En marketing: generar contenido con IA y enviarlo a Ayrshare para publicación programada.
- En documentos: generar PDF al guardar una cotización u orden.

## Activación

1. Crea/obtén las claves de los proveedores que quieras usar.
2. Copia `.env.example` a `.env.local` y completa solo las claves necesarias, o agrégalas como variables de entorno en Vercel.
3. Ejecuta `npm run check` dentro de `api-hub` para revisar qué integraciones están activas.
4. Importa las funciones desde `src/api-hub.mjs` en el backend de cada aplicación.

## Seguridad

Nunca llames APIs con claves secretas directamente desde HTML o JavaScript del navegador. Para producción, estas funciones deben ejecutarse en backend/serverless (por ejemplo, Vercel Functions) y devolver al frontend únicamente los datos necesarios.
