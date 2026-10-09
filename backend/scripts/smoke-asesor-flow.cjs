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
          reject(new Error(`No JSON (status ${res.statusCode}): ${chunks.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const LOG = [];
function step(label, fn) {
  return async () => {
    process.stdout.write(`\n▶ ${label} ...`);
    try {
      const r = await fn();
      console.log(' ✅');
      if (r?.log) LOG.push(label + ' => ' + r.log);
      return r?.data ?? null;
    } catch (e) {
      console.log(' ❌  ' + (e.message || String(e)));
      process.exitCode = 1;
      throw e;
    }
  };
}

async function main() {
  console.log('==============================================================');
  console.log('SIMULACIÓN FLUJO COMPLETO ASESOR (asesor@antony.com)');
  console.log('API: ' + BASE_URL);
  console.log('==============================================================');

  // 1. Login
  const loginData = await step('1) Login ASESOR correo=asesor@antony.com', async () => {
    const { status, body } = await request('POST', '/auth/login', { correo: 'asesor@antony.com', password: 'Asesor123$' });
    if (status !== 200 && status !== 201) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    if (!body || !body.accessToken) throw new Error('Falta accessToken: ' + JSON.stringify(body));
    const { empresaId, id, rolId, nombres, apellidos } = body.usuario;
    if (!empresaId) throw new Error('Falta empresaId en usuario');
    return { log: `usuario ${id} ${nombres} ${apellidos} | empresa=${empresaId}`, data: { token: body.accessToken, empresaId, id, rolId, nombres, apellidos } };
  })();

  const token = loginData.token;
  const empresaId = loginData.empresaId;
  const asesorId = loginData.id;

  // 2. me
  await step('2) GET /auth/me (verificar JWT válido)', async () => {
    const { status, body } = await request('GET', '/auth/me', null, token);
    if (status !== 200) throw new Error('HTTP ' + status);
    if (body.id !== asesorId) throw new Error('me no coincide');
    return { log: body.correo };
  })();

  // 3. GET propiedades (debe existir PALM-101)
  const propiedadId = await step('3) GET /propiedades (existencia PALM-101)', async () => {
    const { status, body } = await request('GET', `/empresas/${empresaId}/propiedades?limit=20`, null, token);
    if (status !== 200) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    const palm = body.data.find((p) => p.codigoInterno === 'PALM-101');
    if (!palm) throw new Error('No se encontró PALM-101 en ' + body.data.map((x) => x.codigoInterno).join(','));
    return { log: `${palm.codigoInterno} = ${palm.id}`, data: palm.id };
  })();

  // 3b) CLEANUP previo: borrar reservas/pipeline/visitas activas de la propiedad PALM-101 de corridas anteriores
  await step('3b) CLEANUP: soft-delete reservas activas previas de PALM-101', async () => {
    const rRes = await request('GET', `/empresas/${empresaId}/reservas?limit=100`, null, token);
    if (rRes.status === 200 && rRes.body?.data) {
      for (const r of rRes.body.data.filter((x) => x.propiedadId === propiedadId && x.active)) {
        await request('DELETE', `/empresas/${empresaId}/reservas/${r.id}`, null, token);
      }
    }
    const pRes = await request('GET', `/empresas/${empresaId}/pipeline?limit=100`, null, token);
    if (pRes.status === 200 && pRes.body?.data) {
      for (const p of pRes.body.data.filter((x) => x.asesorId === asesorId && x.active && x.cliente?.numeroDocumento?.startsWith('7'))) {
        await request('DELETE', `/empresas/${empresaId}/pipeline/${p.id}`, null, token);
      }
    }
    return { log: 'cleanup ok' };
  })();

  // 4. Crear cliente
  const clienteId = await step('4) POST /clientes (crear Juan Pérez)', async () => {
    const suffix = String(Date.now()).slice(-5);
    const payload = {
      tipoDocumento: 'DNI',
      numeroDocumento: '7' + suffix,
      nombres: 'Juan',
      apellidos: 'Pérez Gómez',
      correo: 'juan.perez.' + suffix + '@gmail.com',
      celular: '+51 999 100 200',
      estado: 'NUEVO',
      medioCaptacion: 'WHATSAPP',
      direccion: 'Av. Arequipa 123 - Miraflores',
    };
    const { status, body } = await request('POST', `/empresas/${empresaId}/clientes`, payload, token);
    if (status !== 201) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    return { log: body.id + ' ' + body.nombres + ' ' + body.apellidos, data: body.id };
  })();

  // 5. GET /clientes confirmar
  await step('5) GET /clientes (confirmar Juan Pérez listado)', async () => {
    const { status, body } = await request('GET', `/empresas/${empresaId}/clientes?limit=10`, null, token);
    if (status !== 200) throw new Error('HTTP ' + status);
    if (!body.data.some((c) => c.id === clienteId)) throw new Error('Juan Pérez no está en el listado');
    return { log: 'total=' + body.meta.total };
  })();

  // 6. Editar cliente (cambio nombres y apellidos)
  await step('6) PATCH /clientes/:id (editar → Juan Pablo Pérez)', async () => {
    const { status, body } = await request('PATCH', `/empresas/${empresaId}/clientes/${clienteId}`, { nombres: 'Juan Pablo', apellidos: 'Pérez Gómez', celular: '+51 999 200 300' }, token);
    if (status !== 200) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    if (body.nombres !== 'Juan Pablo') throw new Error('no se actualizó nombres');
    return { log: 'nombres=' + body.nombres + ' / celular=' + body.celular };
  })();

  // 7. POST /pipeline (oportunidad)
  const pipelineId = await step('7) POST /pipeline (oportunidad Dpto 101)', async () => {
    const payload = {
      clienteId,
      asesorId,
      etapa: 'NUEVO',
      prioridad: 'MEDIA',
      probabilidadCierre: 25,
      fechaIngreso: new Date().toISOString(),
      proximaFechaSeguimiento: new Date(Date.now() + 3 * 86400000).toISOString(),
      observaciones: 'Interesado en Dpto 101 torre A. Presupuesto ~$250k',
    };
    const { status, body } = await request('POST', `/empresas/${empresaId}/pipeline`, payload, token);
    if (status !== 201) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    return { log: body.id + ' etapa=' + body.etapa, data: body.id };
  })();

  // 8. Drag & Drop → etapa NUEVO → CONTACTADO → INTERESADO (2 PATCH)
  const etapaFinal = await step('8) PATCH pipeline etapa (NUEVO→CONTACTADO→INTERESADO) [Drag&Drop Kanban]', async () => {
    let etapa = 'CONTACTADO';
    for (let i = 0; i < 2; i++) {
      const { status, body } = await request('PATCH', `/empresas/${empresaId}/pipeline/${pipelineId}`, { etapa }, token);
      if (status !== 200) throw new Error('HTTP ' + status + ' @etapa=' + etapa + ' ' + JSON.stringify(body));
      etapa = 'INTERESADO';
    }
    const { status, body } = await request('GET', `/empresas/${empresaId}/pipeline/${pipelineId}`, null, token);
    if (status !== 200) throw new Error('HTTP ' + status);
    if (body.etapa !== 'INTERESADO') throw new Error('Etapa final no es INTERESADO');
    return { log: 'etapa=' + body.etapa, data: body.etapa };
  })();

  // 9. POST /visitas (programar visita dentro de 3 días)
  const visitaId = await step('9) POST /visitas (visita en 3 días)', async () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 3);
    fecha.setHours(11, 30, 0, 0);
    const payload = {
      clienteId,
      asesorId,
      propiedadId,
      pipelineId,
      fechaHora: fecha.toISOString(),
      duracionEstimada: 60,
      lugarEncuentro: 'Av. La Encalada 1230 - Oficinas de ventas',
      estado: 'PROGRAMADA',
      observaciones: 'Mostrar modelo, plano distribucion y areas comunes',
    };
    const { status, body } = await request('POST', `/empresas/${empresaId}/visitas`, payload, token);
    if (status !== 201) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    return { log: body.id + ' estado=' + body.estado + ' fecha=' + body.fechaHora, data: body.id };
  })();

  // 10. GET /visitas
  await step('10) GET /visitas (confirmar fila aparece)', async () => {
    const { status, body } = await request('GET', `/empresas/${empresaId}/visitas?limit=20`, null, token);
    if (status !== 200) throw new Error('HTTP ' + status);
    if (!body.data.some((v) => v.id === visitaId)) throw new Error('Visita no listada');
    return { log: 'total=' + body.meta.total };
  })();

  // 11. POST /reservas (ACTIVA, monto 5000, vence en 7 días, liga a pipeline y visita)
  const reservaId = await step('11) POST /reservas (reserva ACTIVA S/5000 +7d)', async () => {
    const fechaReserva = new Date();
    const fechaVence = new Date();
    fechaVence.setDate(fechaVence.getDate() + 7);
    const payload = {
      clienteId,
      asesorId,
      propiedadId,
      pipelineId,
      visitaId,
      montoSeparacion: 5000,
      fechaReserva: fechaReserva.toISOString(),
      fechaVencimiento: fechaVence.toISOString(),
      estado: 'ACTIVA',
      observaciones: 'Reserva inicial por Dpto 101, pagara en agencia efectivo.',
    };
    const { status, body } = await request('POST', `/empresas/${empresaId}/reservas`, payload, token);
    if (status !== 201) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    return { log: body.id + ' estado=' + body.estado + ' monto=' + body.montoSeparacion, data: body.id };
  })();

  // 12. GET /reservas
  await step('12) GET /reservas (confirmar fila aparece)', async () => {
    const { status, body } = await request('GET', `/empresas/${empresaId}/reservas?limit=20`, null, token);
    if (status !== 200) throw new Error('HTTP ' + status);
    if (!body.data.some((r) => r.id === reservaId)) throw new Error('Reserva no listada');
    return { log: 'total=' + body.meta.total + ' monto=' + body.data[0].montoSeparacion };
  })();

  // 13. Dashboard KPIs overview
  await step('13) GET /dashboard/kpis/overview (verificar KPI actualizados)', async () => {
    const { status, body } = await request('GET', `/empresas/${empresaId}/dashboard/kpis/overview`, null, token);
    if (status !== 200) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    const checks = [];
    if (!body.clientes || typeof body.clientes.total !== 'number') checks.push('kpi.clientes missing');
    if (!body.propiedades || typeof body.propiedades.total !== 'number') checks.push('kpi.propiedades missing');
    if (!body.reservas || typeof body.reservas.activas !== 'number' || body.reservas.activas < 1) checks.push('reservas.activas < 1');
    if (!body.visitas || typeof body.visitas.programadas !== 'number' || body.visitas.programadas < 1) checks.push('visitas.programadas < 1');
    if (!body.pipeline || !body.pipeline.porEtapa || !body.pipeline.porEtapa[etapaFinal]) checks.push('pipeline.porEtapa[' + etapaFinal + '] = 0');
    if (checks.length) throw new Error('Dashboard: ' + checks.join('; ') + ' => ' + JSON.stringify(body));
    return {
      log: `clientes.total=${body.clientes.total} / reservas.activas=${body.reservas.activas} / visitas.programadas=${body.visitas.programadas} / pipeline[INTERESADO]=${body.pipeline.porEtapa.INTERESADO ?? 0} / propiedades.total=${body.propiedades.total}`,
    };
  })();

  // 14. Soft-delete cliente temporal (limpieza opcional)
  await step('14) DELETE /clientes/:id (soft-delete Juan Pablo - limpieza)', async () => {
    const { status, body } = await request('DELETE', `/empresas/${empresaId}/clientes/${clienteId}`, null, token);
    if (status !== 200 && status !== 204) throw new Error('HTTP ' + status + ' ' + JSON.stringify(body));
    const info = body ? `deletedAt=${body.deletedAt ?? '?'} active=${body.active}` : 'HTTP 204 (No Content)';
    return { log: info };
  })();

  console.log('\n==============================================================');
  console.log('✅ FLUJO COMPLETO ASESOR. RESUMEN:');
  for (const l of LOG) console.log('  • ' + l);
  console.log('==============================================================');
}

main().catch((e) => {
  console.error('\n❌ ABORTADO:', e.message || e);
  process.exit(1);
});
