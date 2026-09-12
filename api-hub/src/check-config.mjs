import { allProviderStatus } from './providers.mjs';

const rows = allProviderStatus().map(({ name, group, purpose, configured, requiresKey }) => ({
  grupo: group,
  proveedor: name,
  estado: configured ? 'LISTO' : 'FALTA CLAVE',
  autenticacion: requiresKey ? 'API key/token' : 'Sin clave',
  uso: purpose
}));

console.table(rows);

const pending = rows.filter(r => r.estado !== 'LISTO');
console.log(`\nConfigurados: ${rows.length - pending.length}/${rows.length}`);
if (pending.length) {
  console.log('Pendientes de activar con credenciales:', pending.map(p => p.proveedor).join(', '));
}
