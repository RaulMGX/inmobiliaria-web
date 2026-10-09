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
      res.setEncoding('utf-8');
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          const json = chunks ? JSON.parse(chunks) : null;
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks.slice(0, 1000) });
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
  const { empresaId } = login.body.usuario;
  console.log('Login OK. empresaId=', empresaId.slice(0, 10));

  const rand = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  const payload = {
    tipoDocumento: 'DNI',
    numeroDocumento: '700' + rand.slice(0, 5),
    nombres: 'Smoke Perfil Compra',
    apellidos: 'Cliente ' + rand,
    celular: '+51 981' + rand.slice(0, 6),
    correo: 'smk_perfil_' + rand + '@x.com',
    distrito: 'Miraflores',
    ciudad: 'Lima',
    medioCaptacion: 'WHATSAPP',
    estado: 'INTERESADO',
    moneda: 'PEN',
    presupuestoMinimo: 150000,
    presupuestoMaximo: 300000,
    tipoPropiedadInteres: 'DEPARTAMENTO',
    propiedadInteresDetalle: 'Dpto 3D, piso alto, vista al mar, balcón y 2 estacionamientos.',
    motivoCompra: 'VIVIENDA_FAMILIAR',
    metodoPagoPreferido: 'CREDITO_HIPOTECARIO',
    bancoPreferencia: 'BCP - Sucursal Miraflores',
    preAprobacionDetalle: 'Carta BCP N°' + rand + ' · USD 200,000 · vence 31/12/2026',
    urgenciaCompra: 'CORTO_PLAZO_3_MESES',
    observaciones: 'Referido por Raul Kelvin. Llamar mañana entre 10-12h.',
  };

  const res = await request('POST', `/empresas/${empresaId}/clientes`, payload, token);
  console.log('\nPOST /clientes HTTP', res.status);
  if (res.status !== 201) {
    console.error('Body:', JSON.stringify(res.body, null, 2).slice(0, 800));
    process.exitCode = 1;
    return;
  }
  const c = res.body;
  console.log('Cliente id=', c.id.slice(0, 14));
  console.log('nombres=', c.nombres, 'apellidos=', c.apellidos);
  console.log('presupuestoMinimo=', c.presupuestoMinimo, 'presupuestoMaximo=', c.presupuestoMaximo, 'moneda=', c.moneda);
  console.log('tipoPropiedadInteres=', c.tipoPropiedadInteres);
  console.log('propiedadInteresDetalle=', c.propiedadInteresDetalle);
  console.log('motivoCompra=', c.motivoCompra);
  console.log('metodoPagoPreferido=', c.metodoPagoPreferido);
  console.log('bancoPreferencia=', c.bancoPreferencia);
  console.log('preAprobacionDetalle=', c.preAprobacionDetalle);
  console.log('urgenciaCompra=', c.urgenciaCompra);

  const EXPECTED = {
    presupuestoMinimo: '150000',
    presupuestoMaximo: '300000',
    tipoPropiedadInteres: 'DEPARTAMENTO',
    motivoCompra: 'VIVIENDA_FAMILIAR',
    metodoPagoPreferido: 'CREDITO_HIPOTECARIO',
    urgenciaCompra: 'CORTO_PLAZO_3_MESES',
  };
  let ok = true;
  Object.keys(EXPECTED).forEach((k) => {
    const real = String(c[k] ?? '');
    const exp = String(EXPECTED[k]);
    if (real !== exp) {
      console.error(`❌ ${k}: esperado=${exp} real=${real}`);
      ok = false;
    } else {
      console.log(`✅ ${k} = ${real}`);
    }
  });
  if (!ok) { process.exitCode = 1; return; }
  console.log('\n✅ TODOS LOS CAMPOS DE PERFIL DE COMPRA SE GUARDARON CORRECTAMENTE.');

  // Ahora GET /clientes listado (confirma que el GET sí devuelve los nuevos campos en el data de la página)
  const list = await request('GET', `/empresas/${empresaId}/clientes?limit=5&search=${encodeURIComponent('Smoke Perfil Compra')}`, null, token);
  console.log('\nGET /clientes HTTP', list.status, 'data.length=', list.body?.data?.length);
  const row = list.body?.data?.find((x) => x.id === c.id);
  if (row) {
    console.log('Campos en listado:', JSON.stringify({
      presupuestoMinimo: row.presupuestoMinimo,
      presupuestoMaximo: row.presupuestoMaximo,
      tipoPropiedadInteres: row.tipoPropiedadInteres,
      motivoCompra: row.motivoCompra,
      urgenciaCompra: row.urgenciaCompra,
      metodoPagoPreferido: row.metodoPagoPreferido,
      bancoPreferencia: row.bancoPreferencia ? '✓ presente' : null,
    }));
  }
}

main().catch(e => { console.error('❌', e.message || e); process.exitCode = 1; });
