<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# TallerManager

Aplicación web para administrar servicios, cotizaciones, pagos y costos de un taller.

Aplicación en AI Studio: https://ai.studio/apps/f186d355-2f6a-4225-846b-94e5e31a4134

## Ejecutar localmente

Requisito: Node.js 20 o superior.

1. Instala dependencias: `npm install`
2. Inicia el entorno: `npm run dev`
3. Ejecuta las pruebas: `npm test`
4. Genera la versión de producción: `npm run build`

## Datos y seguridad

- La sesión utiliza Firebase Authentication.
- Los datos operativos se sincronizan con Firestore bajo el UID de cada cuenta y conservan una copia local para trabajo sin conexión.
- Las fotografías nuevas se guardan en Firebase Storage; se comprimen antes de subirlas.
- Las reglas incluidas en `firestore.rules` y `storage.rules` deben publicarse en el proyecto Firebase antes de poner la aplicación en producción.
- Ninguna clave de Gemini debe incluirse en el navegador. Las funciones de IA deben llamar a un endpoint protegido del servidor bajo `/api/gemini/*`.

## Despliegue de reglas

Con Firebase CLI configurado para el proyecto correcto:

```bash
firebase deploy --only firestore:rules,storage
```

Verifica el proyecto activo con `firebase use` antes de desplegar.
