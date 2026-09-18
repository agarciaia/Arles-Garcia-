import { carVectorRequest } from '../../api-hub/src/api-hub.mjs';
import { providerStatus } from '../../api-hub/src/providers.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, readJson, requireMethod, sendJson } from '../_lib/http.mjs';

function findScalar(root, aliases) {
  const seen = new Set();
  let result;
  const walk = (value, depth = 0) => {
    if (result !== undefined || !value || typeof value !== 'object' || depth > 5 || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (aliases.includes(normalized) && (typeof child === 'string' || typeof child === 'number')) {
        result = child;
        return;
      }
      if (child && typeof child === 'object') walk(child, depth + 1);
      if (result !== undefined) return;
    }
  };
  walk(root);
  return result;
}

function normalizeProviderVehicle(raw) {
  const brand = findScalar(raw, ['brand', 'make', 'manufacturer', 'maker']);
  const model = findScalar(raw, ['model', 'vehiclemodel', 'vehicle_model']);
  const yearRaw = findScalar(raw, ['year', 'modelyear', 'model_year']);
  const mileageRaw = findScalar(raw, ['mileage', 'odometer', 'kilometers', 'kilometres', 'km']);
  const year = Number(String(yearRaw ?? '').replace(/[^0-9]/g, ''));
  const mileage = Number(String(mileageRaw ?? '').replace(/[^0-9]/g, ''));
  const maxYear = new Date().getFullYear() + 2;
  return {
    ...(cleanString(brand, 100) ? { brand: cleanString(brand, 100) } : {}),
    ...(cleanString(model, 120) ? { model: cleanString(model, 120) } : {}),
    ...(year >= 1886 && year <= maxYear ? { year } : {}),
    ...(Number.isFinite(mileage) && mileage > 0 ? { mileage } : {}),
  };
}

async function decodeWithNhtsa(vin) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Gestion-Taller/1.0',
    },
  });

  if (!response.ok) {
    const error = new Error(`No fue posible consultar el decoder VIN de respaldo (${response.status}).`);
    error.statusCode = 502;
    error.code = 'vin_fallback_failed';
    throw error;
  }

  const payload = await response.json();
  const result = Array.isArray(payload?.Results) ? payload.Results[0] : null;
  return {
    vehicle: normalizeProviderVehicle(result || {}),
    raw: result || {},
  };
}

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);

    const body = await readJson(req);
    const vin = cleanString(body.vin, 40).toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      const error = new Error('Ingresa un VIN válido de 17 caracteres. La patente no reemplaza al VIN.');
      error.statusCode = 400;
      error.code = 'invalid_vin';
      throw error;
    }

    const pathTemplate = cleanString(process.env.CARVECTOR_VIN_PATH_TEMPLATE, 500);
    const carVectorConfigured = providerStatus('carvector').configured
      && Boolean(pathTemplate)
      && pathTemplate.includes('{vin}');

    if (carVectorConfigured) {
      try {
        const path = pathTemplate.replace('{vin}', encodeURIComponent(vin));
        const raw = await carVectorRequest(path, { method: 'GET' });
        const vehicle = normalizeProviderVehicle(raw);
        if (Object.keys(vehicle).length > 0) {
          sendJson(res, 200, {
            vehicle,
            fieldsFound: Object.keys(vehicle),
            provider: 'carvector',
          });
          return;
        }
      } catch {
        // Si CarVector falla o no entrega datos útiles, usar el decoder público de respaldo.
      }
    }

    const fallback = await decodeWithNhtsa(vin);
    sendJson(res, 200, {
      vehicle: fallback.vehicle,
      fieldsFound: Object.keys(fallback.vehicle),
      provider: 'nhtsa-vpic',
      fallback: true,
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
