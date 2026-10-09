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
    timeout: 30000,
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
          resolve({ status: res.statusCode, body: chunks.slice(0, 1500) });
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
  console.log('Login OK. empresaId=', empresaId.slice(0, 10), 'asesorId=', asesorId.slice(0, 10));

  let errors = 0;
  const check = (label, res, expected) => {
    const ok = expected.includes(res.status);
    if (ok) console.log(`✅ ${label} HTTP ${res.status}`);
    else {
      console.error(`❌ ${label} HTTP ${res.status} (esperaba ${expected.join('/')}) |`, JSON.stringify(res.body).slice(0, 600));
      errors++;
    }
    return ok;
  };

  // ===================== Paso 1: Limpiar data vieja + crear datos prueba =====================
  console.log('\n[DATA] Preparando 1 visita próxima (2 días) y 1 reserva por vencer (3 días)...');
  const rand = Math.floor(Math.random() * 99999).toString().padStart(5, '0');

  // Buscar cualquier propiedad DISPONIBLE
  const props = await request('GET', `/empresas/${empresaId}/propiedades?page=1&limit=50`, null, token);
  let propiedad = null;
  if (props.status === 200 && Array.isArray(props.body?.data)) {
    // Primero intentar PALM-101, luego primer DISPONIBLE
    const palm = props.body.data.find((p) => p.codigoInterno === 'PALM-101');
    if (palm) propiedad = palm;
    else propiedad = props.body.data.find((p) => p.estado === 'DISPONIBLE') || null;
  }
  if (!propiedad) {
    console.error('❌ No hay propiedades DISPONIBLES en la DB. Ejecuta seed-asesor-demo primero.');
    process.exitCode = 1;
    return;
  }
  if (propiedad.estado !== 'DISPONIBLE') {
    const pr = await request('PATCH', `/empresas/${empresaId}/propiedades/${propiedad.id}`, { estado: 'DISPONIBLE' }, token);
    console.log(`  Propiedad ${propiedad.codigoInterno || propiedad.id.slice(0, 8)} forzada a DISPONIBLE (HTTP ${pr.status})`);
    propiedad.estado = 'DISPONIBLE';
  }
  // Cleanup reserva activa previa de la misma propiedad para evitar 409
  try {
    const reservaList = await request('GET', `/empresas/${empresaId}/reservas?propiedadId=${encodeURIComponent(propiedad.id)}&estado=ACTIVA&page=1&limit=50`, null, token);
    const activas = Array.isArray(reservaList.body?.data) ? reservaList.body.data.filter((r) => r.estado === 'ACTIVA' && r.propiedadId === propiedad.id) : [];
    for (const r of activas) {
      const dr = await request('DELETE', `/empresas/${empresaId}/reservas/${r.id}`, null, token);
      console.log(`  Cleanup reserva activa ${r.id.slice(0, 10)} HTTP ${dr.status}`);
    }
  } catch (_e) { /* ignore */ }
  console.log('  Usando propiedad id=', propiedad.id.slice(0, 10), 'codigoInterno=', propiedad.codigoInterno, 'estado=', propiedad.estado);

  // Buscar cliente activo o crear uno smoke
  let cliente;
  const cList = await request('GET', `/empresas/${empresaId}/clientes?limit=5&search=Smoke+Perfil+Compra`, null, token);
  if (cList.status === 200 && cList.body?.data?.length) cliente = cList.body.data[0];
  else {
    const cRes = await request('POST', `/empresas/${empresaId}/clientes`, {
      tipoDocumento: 'DNI', numeroDocumento: '711' + rand,
      nombres: 'Smoke Notif', apellidos: 'Cliente ' + rand,
      celular: '+51 971' + rand,
      medioCaptacion: 'REFERIDO',
      motivoCompra: 'VIVIENDA_FAMILIAR',
      metodoPagoPreferido: 'CREDITO_HIPOTECARIO',
      urgenciaCompra: 'CORTO_PLAZO_3_MESES',
    }, token);
    if (cRes.status !== 201) { console.error('❌ No se pudo crear cliente smoke', JSON.stringify(cRes.body).slice(0, 500)); process.exitCode = 1; return; }
    cliente = cRes.body;
    console.log('  Cliente smoke creado id=', cliente.id.slice(0, 10));
  }

  // Crear visita próxima (dentro de 36 horas, dentro de ventana 2 días)
  const fh = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
  const visitRes = await request('POST', `/empresas/${empresaId}/visitas`, {
    clienteId: cliente.id, propiedadId: propiedad.id, asesorId,
    fechaHora: fh, estado: 'CONFIRMADA', duracionEstimada: 60,
    lugarEncuentro: 'Recepción Condominio Las Palmeras',
    observaciones: 'Smoke notif: visita próxima en 36 horas',
    resultado: '',
  }, token);
  let visita;
  if (visitRes.status === 201) { visita = visitRes.body; console.log('  Visita próxima creada (36h) id=', visita.id.slice(0, 10)); }
  else console.warn('  (aviso) Crear visita HTTP', visitRes.status, JSON.stringify(visitRes.body).slice(0, 300));

  // Crear reserva por vencer (dentro de 70 horas, dentro de ventana 3 días)
  const fv = new Date(Date.now() + 70 * 3600 * 1000).toISOString();
  const reservaRes = await request('POST', `/empresas/${empresaId}/reservas`, {
    clienteId: cliente.id, propiedadId: propiedad.id, asesorId,
    montoSeparacion: 1000,
    fechaReserva: new Date().toISOString(),
    fechaVencimiento: fv,
    estado: 'ACTIVA',
    observaciones: 'smoke notif reserva por vencer',
  }, token);
  let reserva;
  if (reservaRes.status === 201) { reserva = reservaRes.body; console.log('  Reserva por vencer creada (dentro de 70h) id=', reserva.id.slice(0, 10)); }
  else { console.error('  ❌ Crear reserva falló HTTP', reservaRes.status, JSON.stringify(reservaRes.body).slice(0, 500)); process.exitCode = 1; return; }

  const expectedMinNotif = (visita ? 1 : 0) + (reserva ? 1 : 0);
  console.log('  Notificaciones esperadas en sincronizar >=', expectedMinNotif);

  // Cleanup: marcar todas las notificaciones PENDIENTES de este asesor como leídas para tests deterministas
  {
    const clr = await request('PATCH', `/empresas/${empresaId}/notificaciones/marcar-todas-leidas?asesorId=${asesorId}`, null, token);
    if (clr.status === 200) console.log('  Cleanup: marcadas', clr.body?.marcadas ?? 0, 'notif pendientes previas.');
  }

  // ===================== Paso 2: Endpoints notificaciones =====================
  console.log('\n[TESTS] Ejecutando pruebas de Notificaciones y Alertas.');

  // PASO 2.1: Sincronizar (debe generar >= expectedMinNotif)
  const sync = await request('POST', `/empresas/${empresaId}/notificaciones/sincronizar?asesorId=${asesorId}`, null, token);
  if (!check('(2.1) POST notificaciones/sincronizar', sync, [200])) return finish();
  const creadas = (sync.body?.creadas ?? 0) + (sync.body?.actualizadas ?? 0);
  console.log('  → total notif afectadas=', creadas, 'detalle=', JSON.stringify(sync.body));
  if (creadas < expectedMinNotif) { console.error(`❌ (2.1) sincronizar debió generar al menos ${expectedMinNotif} notif. Obtenido: ${creadas}`); errors++; }

  // PASO 2.2: Listado paginado GET notificaciones
  const list = await request('GET', `/empresas/${empresaId}/notificaciones?asesorId=${asesorId}&page=1&limit=20`, null, token);
  if (!check('(2.2) GET /notificaciones (listado)', list, [200])) return finish();
  const rows = list.body?.data || [];
  console.log('  → list.length=', rows.length, 'total=', list.body?.meta?.total, 'pages=', list.body?.meta?.totalPages);
  if (rows.length < expectedMinNotif) { console.error(`❌ (2.2) listado devuelve ${rows.length} filas, esperaba >=${expectedMinNotif}`); errors++; }
  rows.slice(0, 2).forEach((n) => console.log('    * id=', n.id.slice(0, 10), 'tipo=', n.tipo, 'leida=', n.leida, 'fecha=', n.fechaNotificacion?.slice(0, 10), 'titulo=', n.titulo?.slice(0, 40)));

  // PASO 2.3: Contador pendientes (POSIBLE BUG Prisma7 groupBy scalar FK empresaId/asesorId)
  const cont = await request('GET', `/empresas/${empresaId}/notificaciones/pendientes/contador?asesorId=${asesorId}`, null, token);
  let pendientesReal = 0;
  if (check('(2.3) GET pendientes/contador', cont, [200])) {
    pendientesReal = Number(cont.body?.totalPendientes ?? 0);
    const shouldBe = rows.filter((x) => !x.leida).length;
    console.log('  → totalPendientes API=', pendientesReal, 'porTipo=', JSON.stringify(cont.body?.porTipo || {}), 'esperado segun listado=', shouldBe);
    if (rows.length > 0 && pendientesReal !== shouldBe) {
      console.error(`❌ (2.3) BUG Prisma7 groupBy: totalPendientes=${pendientesReal} pero debería ser ${shouldBe}. groupBy with scalar FK where devuelve 0!`);
      errors++;
    } else console.log('✅ (2.3) Contador pendientes coincide con datos listado.');
  }

  // PASO 2.4: Marcar una notif leída
  if (rows.length > 0) {
    const n = rows[0];
    const p = await request('PATCH', `/empresas/${empresaId}/notificaciones/${n.id}/leida`, { leida: true }, token);
    if (check('(2.4) PATCH :id/leida (true)', p, [200])) {
      console.log('  → leida=', p.body.leida, 'fechaLeida=', p.body.fechaLeida?.slice(0, 10));
      if (p.body.leida !== true || !p.body.fechaLeida) { console.error('❌ (2.4) no actualizó'); errors++; }
    }
    const p2 = await request('PATCH', `/empresas/${empresaId}/notificaciones/${n.id}/leida`, { leida: false }, token);
    if (check('(2.4b) PATCH :id/leida (rollback false)', p2, [200])) {
      if (p2.body.leida !== false || p2.body.fechaLeida !== null) { console.error('❌ (2.4b) rollback leida=false falló'); errors++; }
    }
  }

  // PASO 2.5: Marcar todas leídas
  const mt = await request('PATCH', `/empresas/${empresaId}/notificaciones/marcar-todas-leidas?asesorId=${asesorId}`, null, token);
  if (check('(2.5) PATCH marcar-todas-leidas', mt, [200])) {
    console.log('  → marcadas=', mt.body?.marcadas);
    const listAfter = await request('GET', `/empresas/${empresaId}/notificaciones?asesorId=${asesorId}&leida=false&page=1&limit=100`, null, token);
    const quedanPend = listAfter.body?.data?.length ?? 0;
    if (quedanPend !== 0) { console.error(`❌ (2.5) marcar-todas-leidas: quedan ${quedanPend} pendientes, esperaba 0`); errors++; }
    else console.log('✅ (2.5) Quedan 0 pendientes tras marcar-todas-leidas.');

    // Volver a ejecutar contador: totalPendientes debe ser 0
    const cont2 = await request('GET', `/empresas/${empresaId}/notificaciones/pendientes/contador?asesorId=${asesorId}`, null, token);
    if (cont2.status === 200) {
      const pend = cont2.body?.totalPendientes ?? -1;
      if (pend !== 0) { console.error(`❌ (2.5b) contador totalPendientes=${pend} después de marcar todas leídas. Esperaba 0!`); errors++; }
      else console.log('✅ (2.5b) Contador pendientes = 0 (OK).');
    }
  }

  // PASO 2.6: Filtros: leida=true, tipo, asesorId
  const listL = await request('GET', `/empresas/${empresaId}/notificaciones?asesorId=${asesorId}&leida=true&page=1&limit=20`, null, token);
  if (check('(2.6a) filtro ?leida=true', listL, [200])) {
    const todasL = (listL.body?.data || []).every((x) => x.leida === true);
    if (!todasL) { console.error('❌ (2.6a) filtro leida=true falla filas con leida=false'); errors++; }
    else console.log('✅ (2.6a) Filtro leida=true OK.');
  }

  if (reserva) {
    const t = 'RESERVA_POR_VENCER';
    const listT = await request('GET', `/empresas/${empresaId}/notificaciones?asesorId=${asesorId}&tipo=${t}&page=1&limit=20`, null, token);
    if (check(`(2.6b) filtro ?tipo=${t}`, listT, [200])) {
      const todasT = (listT.body?.data || []).every((x) => x.tipo === t);
      if (!todasT) { console.error('❌ (2.6b) filtro tipo falla'); errors++; }
      else console.log(`✅ (2.6b) Filtro tipo=${t} OK, rows=${listT.body?.data?.length}.`);
    }
  }

  // PASO 2.7: Paginación: page=2 no falla
  const p2 = await request('GET', `/empresas/${empresaId}/notificaciones?asesorId=${asesorId}&page=999&limit=20`, null, token);
  if (check('(2.7) Paginación page=999 (debe devolver data=[], no 500)', p2, [200])) console.log('✅ (2.7) Paginación OK, totalPages=', p2.body?.meta?.totalPages);

  finish();
  function finish() {
    console.log('\n' + (errors === 0 ? '🏁 TODAS LAS NOTIFICACIONES FUNCIONAN (TODOS LOS ENDPOINTS OK).' : `🏁 ${errors} fallo(s) encontrado(s).`));
    process.exitCode = errors === 0 ? 0 : 1;
  }
}

main().catch(e => { console.error('❌ CRASH:', e.message || e); process.exitCode = 1; });
