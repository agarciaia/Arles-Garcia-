<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Gestión Taller

Aplicación web para administrar servicios, cotizaciones, pagos y costos de un taller.

Aplicación en AI Studio: https://ai.studio/apps/f186d355-2f6a-4225-846b-94e5e31a4134

## Ejecutar localmente

Requisito: Node.js 20 o superior.

1. Instala dependencias: `npm install`
2. Inicia el entorno: `npm run dev`
3. Ejecuta el typecheck: `npm run typecheck`
4. Ejecuta las pruebas: `npm test`
5. Genera la versión de producción: `npm run build`

## IA, voz y API Hub

Gestión Taller reutiliza `api-hub/` y expone las funciones de IA únicamente mediante endpoints protegidos en `/api/*`.

Funciones disponibles en la aplicación:

- **Crear orden por voz:** graba desde el navegador, transcribe con Groq Whisper y prepara un borrador estructurado. La orden no se guarda hasta que el usuario la revisa y confirma.
- **Router multi-IA:** el chat, la preparación de órdenes, el análisis de servicios y los mensajes al cliente usan el router del API Hub y pueden continuar con otro proveedor configurado si uno falla.
- **Análisis de servicio:** entrega resumen, trabajos detectados, repuestos mencionados, información faltante, preguntas sugeridas y un mensaje breve. Se presenta siempre como sugerencia, no como diagnóstico definitivo.
- **Mensajes para clientes:** genera vistas previas editables para recepción, cotización lista, trabajo terminado y saldo pendiente. Nunca envía WhatsApp automáticamente.
- **VIN:** permite consultar un VIN válido cuando CarVector y su ruta oficial están configurados. Solo aplica datos entregados por el proveedor y nunca trata una patente como VIN.

Endpoints principales:

- `POST /api/ai/chat`
- `POST /api/ai/transcribe`
- `POST /api/ai/workshop-intake`
- `POST /api/ai/analyze-service`
- `POST /api/ai/customer-message`
- `GET /api/ai/status`
- `POST /api/vehicle/vin`

Todos requieren una sesión Firebase válida. El frontend envía el ID token y el backend lo valida antes de utilizar cualquier proveedor externo.

## Variables de entorno

Usa `.env.example` como inventario y configura los secretos en **Vercel Environment Variables** o en tu entorno local privado. Nunca escribas claves reales en GitHub.

Para la función de voz se necesita:

- `GROQ_API_KEY`

Para las funciones de texto configura al menos un proveedor compatible, por ejemplo:

- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `CEREBRAS_API_KEY`
- `MISTRAL_API_KEY`

El router puede usar otros proveedores incluidos en `api-hub` si están configurados.

Para VIN:

- `CARVECTOR_API_KEY`
- `CARVECTOR_VIN_PATH_TEMPLATE` con `{vin}` en la ruta oficial correspondiente a tu cuenta/plan.

Si una credencial opcional falta, esa función queda desactivada de forma controlada y el resto de Gestión Taller sigue funcionando.

## Datos y seguridad

- La sesión utiliza Firebase Authentication.
- Los datos operativos se sincronizan con Firestore bajo el UID de cada cuenta y conservan una copia local para trabajo sin conexión.
- Las fotografías se comprimen en el dispositivo y se guardan de forma privada en Firebase Storage bajo el UID de cada taller.
- Las reglas incluidas en `firestore.rules` y `storage.rules` deben publicarse en el proyecto Firebase antes de poner la aplicación en producción.
- Ninguna clave de Groq, OpenRouter, Gemini, CarVector ni de otro proveedor privado debe incluirse en el navegador.
- Las funciones de IA se ejecutan en endpoints protegidos bajo `/api/ai/*` y leen secretos mediante `process.env` solo en servidor.
- `services/aiSecurity.test.ts` protege contra regresiones que intenten exponer credenciales privadas en código de navegador.

## Despliegue de reglas

Con Firebase CLI configurado para el proyecto correcto:

```bash
firebase deploy --only firestore:rules,storage
```

Verifica el proyecto activo con `firebase use` antes de desplegar.
