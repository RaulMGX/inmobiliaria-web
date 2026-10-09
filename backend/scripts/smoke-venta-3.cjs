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
  console.log('PALM-101 estado=', palm.estado, 'id=', palm.id.slice(0, 12));

  // Si está VENDIDO, revertimos a DISPONIBLE para testear (llamada patch directa).
  if (palm.estado === 'VENDIDO') {
    const patch = await request('PATCH', `/empresas/${empresaId}/propiedades/${palm.id}`, { estado: 'DISPONIBLE' }, token);
    console.log('PATCH propiedad estado HTTP', patch.status, 'estado result=', patch.body?.estado);
  }

  // Limpiar reservas activas de PALM-101.
  const listR = await request('GET', `/empresas/${empresaId}/reservas?limit=100`, null, token);
  for (const r of (listR.body.data || [])) {
    if (r.propiedadId === palm.id && r.estado === 'ACTIVA' && r.active && !r.deletedAt) {
      const d = await request('DELETE', `/empresas/${empresaId}/reservas/${r.id}`, null, token);
      console.log('DELETE reserva ACTIVA', r.id.slice(0, 10), 'HTTP', d.status);
    }
  }
  // Limpiar ventas existentes de PALM-101 soft-delete.
  const listV = await request('GET', `/empresas/${empresaId}/ventas?limit=100`, null, token);
  for (const v of (listV.body.data || [])) {
    if (v.propiedadId === palm.id && v.active && !v.deletedAt) {
      const d = await request('DELETE', `/empresas/${empresaId}/ventas/${v.id}`, null, token);
      console.log('DELETE venta previa', v.id.slice(0, 10), 'HTTP', d.status);
    }
  }

  const cResList = await request('GET', `/empresas/${empresaId}/clientes?limit=50`, null, token);
  let cliente = cResList.body.data.find(c => c.active && !c.deletedAt);
  if (!cliente) {
    const nc = await request('POST', `/empresas/${empresaId}/clientes`, { tipoDocumento: 'DNI', numeroDocumento: '70000012', nombres: 'Smoke Venta Cliente', apellidos: 'X', correo: 'smv2@x.com', celular: '+51 900 000 012', estado: 'NUEVO', medioCaptacion: 'WHATSAPP', direccion: 'x' }, token);
    cliente = nc.body;
  }
  console.log('cliente id=', cliente.id.slice(0, 12), 'active=', cliente.active);

  const rp = await request('POST', `/empresas/${empresaId}/reservas`, {
    clienteId: cliente.id,
    asesorId,
    propiedadId: palm.id,
    montoSeparacion: 500,
    fechaReserva: new Date().toISOString(),
    fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString(),
    estado: 'ACTIVA',
    observaciones: 'sv directa 3',
  }, token);
  console.log('POST reserva HTTP', rp.status, JSON.stringify(rp.body).slice(0, 400));
  if (rp.status !== 201) { process.exitCode = 1; return; }
  const reserva = rp.body;

  const checkR = await request('GET', `/empresas/${empresaId}/reservas/${reserva.id}`, null, token);
  console.log('GET /reservas/', reserva.id.slice(0, 10), 'HTTP', checkR.status, 'estado=', checkR.body?.estado, 'clienteId=', checkR.body?.clienteId?.slice(0, 10), 'propiedadId=', checkR.body?.propiedadId?.slice(0, 10), 'asesorId=', checkR.body?.asesorId?.slice(0, 10));

  const precioFinal = Number(palm.precio ?? 0) || 250000;
  const payloadCREDITO = {
    reservaId: reserva.id,
    clienteId: reserva.clienteId,
    asesorId,
    propiedadId: palm.id,
    estado: 'PENDIENTE_FORMALIZACION',
    metodoPago: 'CREDITO_HIPOTECARIO',
    precioFinal,
    descuento: 0,
    impuestos: 0,
    totalVenta: precioFinal,
    fechaVenta: new Date().toISOString(),
    observaciones: `sv credito ${new Date().toISOString()}`,
  };
  const vRes = await request('POST', `/empresas/${empresaId}/ventas`, payloadCREDITO, token);
  console.log('\nPOST /ventas (CREDITO_HIPOTECARIO, montoSeparacion=500) HTTP', vRes.status, '\n', JSON.stringify(vRes.body).slice(0, 900));
  if (vRes.status !== 201) { process.exitCode = 1; return; }
  const EXPECTED_SALDO = precioFinal - 500;
  const actual = Number(vRes.body.saldoPendiente || 0);
  console.log('\n=== VERIFICACIÓN SALDO PENDIENTE ===');
  console.log('precioFinal=', precioFinal, 'montoSeparacion(seña)=500 => saldoPendiente esperado=', EXPECTED_SALDO);
  console.log('saldoPendiente REAL=', actual, 'moneda=', typeof actual);
  if (Math.abs(actual - EXPECTED_SALDO) > 0.01) {
    console.error('❌ SALDO INCORRECTO: debería ser', EXPECTED_SALDO, 'pero fue', actual);
    process.exitCode = 1;
    return;
  }
  console.log('✅ SALDO PENDIENTE OK (seña descontada correctamente).');
  console.log('\n✅ FLUJO COMPLETO.');
  console.log('Venta id=', vRes.body.id.slice(0, 14));
  console.log('Reserva quedó estado=', vRes.body.reserva?.estado);
  console.log('Propiedad quedó estado=', vRes.body.propiedad?.estado);
  console.log('metodoPago venta=', vRes.body.metodoPago, '(CREDITO_HIPOTECARIO → saldo pendiente = financia/cuotas)');
}

main().catch(e => { console.error('❌', e.message || e); process.exitCode = 1; });
