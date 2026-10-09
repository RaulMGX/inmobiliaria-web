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
    timeout: 20000,
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
  const login = await request('POST', '/auth/login', { correo: 'asesor@antony.com', password: 'Asesor123$' });
  const token = login.body.accessToken;
  const { empresaId, id: asesorId } = login.body.usuario;
  console.log('Login OK.');

  const pRes = await request('GET', `/empresas/${empresaId}/propiedades?limit=20`, null, token);
  const palm = pRes.body.data.find(p => p.codigoInterno === 'PALM-101');
  const propiedadId = palm.id;
  console.log('PALM-101 precio=', palm.precio, 'id=', propiedadId.slice(0,12));

  const cResList = await request('GET', `/empresas/${empresaId}/clientes?limit=50`, null, token);
  let cliente = cResList.body.data.find(c => c.active && !c.deletedAt);
  if (!cliente) {
    const nc = await request('POST', `/empresas/${empresaId}/clientes`, { tipoDocumento: 'DNI', numeroDocumento: '70000009', nombres: 'Smoke Venta Cliente', apellidos: 'X', correo: 'smv@x.com', celular: '+51 900 000 009', estado: 'NUEVO', medioCaptacion: 'WHATSAPP', direccion: 'x' }, token);
    cliente = nc.body;
  }
  console.log('cliente id=', cliente.id.slice(0,12), 'active=', cliente.active);

  const listR = await request('GET', `/empresas/${empresaId}/reservas?limit=100`, null, token);
  const propReservasActivas = listR.body.data.filter(r => r.propiedadId === propiedadId && r.estado === 'ACTIVA' && r.active && !r.deletedAt);
  for (const r of propReservasActivas) {
    const d = await request('DELETE', `/empresas/${empresaId}/reservas/${r.id}`, null, token);
    console.log('DELETE reserva ACTIVA previa', r.id.slice(0,10), 'HTTP', d.status);
  }

  const rp = await request('POST', `/empresas/${empresaId}/reservas`, {
    clienteId: cliente.id,
    asesorId,
    propiedadId,
    montoSeparacion: 250.50,
    fechaReserva: new Date().toISOString(),
    fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString(),
    estado: 'ACTIVA',
    observaciones: 'sv directa',
  }, token);
  console.log('POST reserva HTTP', rp.status, JSON.stringify(rp.body).slice(0, 300));
  const reserva = rp.body;
  if (rp.status !== 201) { process.exitCode = 1; return; }

  const checkReserva = await request('GET', `/empresas/${empresaId}/reservas/${reserva.id}`, null, token);
  console.log('GET /reservas/', reserva.id.slice(0,10), 'HTTP', checkReserva.status, 'estado=', checkReserva.body?.estado, 'clienteId=', checkReserva.body?.clienteId?.slice(0,10));

  const precioFinal = Number(palm.precio ?? 0) || 250000;
  const payload = {
    reservaId: reserva.id,
    clienteId: reserva.clienteId,
    asesorId,
    propiedadId,
    estado: 'PAGADA',
    metodoPago: 'CONTADO',
    precioFinal,
    descuento: 0,
    impuestos: 0,
    totalVenta: precioFinal,
    observaciones: `sv ${new Date().toISOString()}`,
  };
  const vRes = await request('POST', `/empresas/${empresaId}/ventas`, payload, token);
  console.log('POST /ventas HTTP', vRes.status, JSON.stringify(vRes.body).slice(0, 700));
  if (vRes.status !== 201) { process.exitCode = 1; return; }
  console.log('✅ Venta OK. id=', vRes.body.id.slice(0,12), 'reserva.estado=', vRes.body.reserva?.estado, 'propiedad.estado=', vRes.body.propiedad?.estado);
}

main().catch(e => { console.error('❌', e.message || e); process.exitCode = 1; });
