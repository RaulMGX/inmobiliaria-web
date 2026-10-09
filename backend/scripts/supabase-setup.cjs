require('dotenv').config({ path: ['.env.local', '.env'] });
const { Client } = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');

const FORCE_DB_URI = process.env.FORCE_DB_URI || process.env.DATABASE_URL;

if (!FORCE_DB_URI) {
  console.error('ERROR: falta FORCE_DB_URI o DATABASE_URL');
  process.exit(1);
}

const SCHEMA_SQL = path.join(__dirname, 'supabase_schema_completo.sql');

async function main() {
  const client = new Client({ connectionString: FORCE_DB_URI });
  try {
    await client.connect();
    console.log('[Supabase] Conectado OK a', FORCE_DB_URI.split('@')[1] || '');
    const schemaSql = fs.readFileSync(SCHEMA_SQL, 'utf8');
    console.log('[1/3] Ejecutando schema (22 migraciones Prisma, 1097 líneas)...');
    await client.query(schemaSql);
    console.log('[2/3] Schema OK. Generando bcrypt hashes + seeds admin/asesor/proyecto/propiedad...');
    const ADMIN_PASS = await bcrypt.hash('Admin123$', 10);
    const ASESOR_PASS = await bcrypt.hash('Asesor123$', 10);
    const q = `
-- ================== SEEDS: ADMIN + ASESOR ==================
INSERT INTO empresas (id, nombre, ruc, telefono, correo, direccion, active, created_at, updated_at)
VALUES ('emp_demo_001', 'Inmobiliaria Antony S.A.C.', '20123456789', '+51 01 1234567', 'contacto@antony.com', 'Av. Paseo de la República 123, Lima, Perú', true, NOW(), NOW())
ON CONFLICT (ruc) DO NOTHING;

INSERT INTO roles (id, nombre, descripcion, active, created_at, updated_at, empresa_id) VALUES
  ('rol_demo_admin', 'ADMIN', 'Acceso total al sistema', true, NOW(), NOW(), 'emp_demo_001'),
  ('rol_demo_asesor', 'ASESOR', 'Acceso a sus propios registros', true, NOW(), NOW(), 'emp_demo_001')
ON CONFLICT (empresa_id, nombre) DO NOTHING;

INSERT INTO usuarios (id, nombres, apellidos, correo, password, telefono, active, created_at, updated_at, empresa_id, rol_id) VALUES
  ('usr_demo_admin', 'Administrador', 'Antony', 'admin@antony.com', $1, '+51 987 654 321', true, NOW(), NOW(), 'emp_demo_001', 'rol_demo_admin'),
  ('usr_demo_asesor', 'Raul kelvin', 'Mendoza guevara', 'asesor@antony.com', $2, '+51 980 123 456', true, NOW(), NOW(), 'emp_demo_001', 'rol_demo_asesor')
ON CONFLICT (empresa_id, correo) DO NOTHING;

INSERT INTO proyectos (id, nombre, descripcion, direccion, ciudad, pais, empresa_id, active, created_at, updated_at) VALUES
  ('proy_demo_01', 'Condominio Las Palmeras', 'Condominio residencial de 4 torres con piscina, areas verdes y parrillas.', 'Av. Las Palmeras 123, Santiago de Surco', 'Lima', 'Perú', 'emp_demo_001', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO propiedades (id, codigo_interno, nombre, tipo_propiedad, piso, habitaciones, banos, area_m2, precio_soles, precio_dolares, estado, descripcion, proyecto_id, empresa_id, active, created_at, updated_at) VALUES
  ('prop_demo_101', 'PALM-101', 'Departamento PALM-101', 'DEPARTAMENTO', 1, 3, 2, 95.00, 380000, 105000, 'DISPONIBLE', 'Lindísimo departamento de 3 habitaciones con balcón oriente.', 'proy_demo_01', 'emp_demo_001', true, NOW(), NOW())
ON CONFLICT (codigo_interno, empresa_id) DO NOTHING;
`;
    await client.query(q, [ADMIN_PASS, ASESOR_PASS]);
    console.log('[3/3] Seeds insertados OK.');
    console.log('');
    console.log('===== VERIFICACIÓN RÁPIDA =====');
    const cnt = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`);
    console.log('Tablas en public (schema Prisma):', cnt.rows.length);
    for (const r of cnt.rows) console.log('   •', r.tablename);
    const cntU = await client.query(`SELECT correo, active FROM usuarios WHERE empresa_id='emp_demo_001' ORDER BY correo;`);
    console.log('\nUsuarios creados:');
    for (const r of cntU.rows) console.log('   •', r.correo, ' active=' + r.active);
    console.log('\n✅ Listo. Cierra esta ventana y dime "listo supabase sql" para seguir con RENDER y VERCEL.');
  } catch (e) {
    console.error('❌ ERROR SUPABASE:', e.message);
    console.error('Stack primeras 2 líneas:', e.stack.split('\n').slice(0,2).join('\n'));
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
