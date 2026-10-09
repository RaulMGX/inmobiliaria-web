const http = require('http');
const BASE_URL = process.argv[2] || 'http://localhost:3000/api/v1';

function request(method, path, body, token) {
  const url = new URL(BASE_URL + path);
  const data = body ? Buffer.from(JSON.stringify(body)) : null;
  const opts = {
    method,
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(data ? { 'Content-Length': data.length } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    timeout: 15000,
  };
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          const json = chunks ? JSON.parse(chunks) : null;
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('==============================================================');
  console.log('SMOKE VENTA SOLAMENTE (POST /empresas/:id/ventas)');
  console.log('API: ' + BASE_URL);
  console.log('==============================================================');

  const login = await request('POST', '/auth/login', { correo: 'asesor@antony.com', password: 'Asesor123$' });
  if (login.status !== 200 && login.status !== 201) throw new Error(`Login falló HTTP ${login.status}: ${JSON.stringify(login.body)}`);
  const token = login.body.accessToken;
  const usuario = login.body.usuario;
  const empresaId = usuario.empresaId;
  const asesorId = usuario.id;
  console.log(`✅ Login OK. asesorId=${asesorId.slice(0,12)} empresaId=${empresaId.slice(0,14)}`);

  const propRes = await request('GET', `/empresas/${empresaId}/propiedades?limit=100`, null, token);
  if (propRes.status !== 200) throw new Error('GET propiedades HTTP ' + propRes.status);
  const palm = propRes.body.data.find((p) => p.codigoInterno === 'PALM-101');
  if (!palm) throw new Error('No existe PALM-101 para reservar.');
  const propiedadId = palm.id;
  const propiedadPrecio = Number(palm.precio ?? 0) || 250000;
  console.log(`✅ Propiedad PALM-101 id=${propiedadId.slice(0,12)} precio=${propiedadPrecio}`);

  const reservasRes = await request('GET', `/empresas/${empresaId}/reservas?limit=100`, null, token);
  if (reservasRes.status !== 200) throw new Error('GET reservas HTTP ' + reservasRes.status);
  const ventasRes = await request('GET', `/empresas/${empresaId}/ventas?limit=100`, null, token).catch(() => ({ status: 0, body: { data: [] } }));
  const ventaReservaIds = new Set((ventasRes.body?.data || []).map((v) => v.reservaId).filter(Boolean));
  const clientesRes = await request('GET', `/empresas/${empresaId}/clientes?limit=50`, null, token);
  if (clientesRes.status !== 200) throw new Error('GET clientes HTTP ' + clientesRes.status);
  const clienteActivo = (clientesRes.body.data || []).find((c) => c.active && !c.deletedAt);
  let clienteId = clienteActivo ? clienteActivo.id : null;
  if (!clienteId) {
    const cBody = { tipoDocumento: 'DNI', numeroDocumento: '70000001', nombres: 'Cliente Smoke', apellidos: 'Venta', correo: 'smoke@venta.com', celular: '+51 900 000 001', estado: 'NUEVO', medioCaptacion: 'WHATSAPP', direccion: 'Av. Prueba 1' };
    const cRes = await request('POST', `/empresas/${empresaId}/clientes`, cBody, token);
    if (cRes.status !== 201) throw new Error('POST cliente HTTP ' + cRes.status + ' ' + JSON.stringify(cRes.body));
    clienteId = cRes.body.id;
  }
  console.log(`✅ Cliente activo id=${clienteId.slice(0,12)}`);
  const reservasProp = (reservasRes.body.data || []).filter((r) => r.propiedadId === propiedadId);
  for (const rp of reservasProp) {
    if (rp.estado === 'ACTIVA' && rp.active && !rp.deletedAt) {
      const dRes = await request('DELETE', `/empresas/${empresaId}/reservas/${rp.id}`, null, token);
      console.log(`→ Soft-delete reserva ACTIVA ${rp.id.slice(0,10)} => HTTP ${dRes.status}`);
    }
  }
  let reserva = (reservasRes.body.data || []).find((r) => r.estado === 'ACTIVA' && r.propiedadId === propiedadId && r.asesorId === asesorId && r.active && !r.deletedAt && String(r.clienteId) === String(clienteId) && !ventaReservaIds.has(r.id));
  if (!reserva) {
    console.log(`→ Creando RESERVA ACTIVA NUEVA (sin venta registrada)`);
    const payload = { clienteId, asesorId, propiedadId, montoSeparacion: 250.50, fechaReserva: new Date().toISOString(), fechaVencimiento: new Date(Date.now() + 7*86400000).toISOString(), estado: 'ACTIVA', observaciones: 'Smoke venta fix Prisma7 scalar IDs.' };
    const rRes = await request('POST', `/empresas/${empresaId}/reservas`, payload, token);
    if (rRes.status !== 201) throw new Error('POST reserva HTTP ' + rRes.status + ' ' + JSON.stringify(rRes.body));
    reserva = rRes.body;
  }
  console.log(`✅ Reserva ACTIVA id=${reserva.id.slice(0,12)} clienteId=${(reserva.clienteId||'?').slice(0,12)} montoSeparacion=${reserva.montoSeparacion}`);

  const reservaClienteId = reserva.clienteId;
  const precioFinal = propiedadPrecio;
  const descuento = 0;
  const impuestos = 0;
  const totalVenta = precioFinal - descuento + impuestos;
  const payload = {
    reservaId: reserva.id,
    clienteId: reservaClienteId,
    asesorId,
    propiedadId,
    estado: 'PAGADA',
    metodoPago: 'CONTADO',
    precioFinal,
    descuento,
    impuestos,
    totalVenta,
    observaciones: `Smoke test scalar IDs Prisma7. [${new Date().toISOString()}]`,
  };
  process.stdout.write(`▶ 15) POST /ventas (precioFinal=${precioFinal} totalVenta=${totalVenta}) ...`);
  const vRes = await request('POST', `/empresas/${empresaId}/ventas`, payload, token);
  if (vRes.status !== 201) {
    console.log(' ❌ HTTP', vRes.status, JSON.stringify(vRes.body).slice(0, 600));
    process.exitCode = 1;
    return;
  }
  const venta = vRes.body;
  console.log(' ✅');
  console.log(`→ Venta id=${venta.id.slice(0,14)} estado=${venta.estado} totalVenta=${venta.totalVenta}`);
  console.log(`→ Reserva quedó estado=${venta.reserva?.estado ?? '?'} · Propiedad quedó estado=${venta.propiedad?.estado ?? '?'}`);

  process.stdout.write(`▶ 16) GET /ventas/:id (verificar listado) ...`);
  const gRes = await request('GET', `/empresas/${empresaId}/ventas/${venta.id}`, null, token);
  if (gRes.status !== 200) { console.log(' ❌ HTTP', gRes.status); process.exitCode = 1; return; }
  console.log(' ✅');
}

main().catch((e) => {
  console.error('\n❌ ABORTADO:', e.message || e);
  process.exitCode = 1;
});
