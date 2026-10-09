require('dotenv').config({ path: ['.env.local', '.env'] });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const RUC_EMPRESA = '20123456789';
const ADMIN_PASSWORD = 'Admin123$';
const ADMIN_CORREO = 'admin@antony.com';

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: falta DATABASE_URL en .env.local/.env');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, max: 3 });
  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    console.log(`[1/5] Password hash generado para "${ADMIN_PASSWORD}".`);

    await client.query('BEGIN');

    // 1) Upsert empresa por RUC (unique) y obtener su ID real
    const resEmp = await client.query(
      `
      WITH sel AS (SELECT id, nombre, ruc FROM empresas WHERE ruc = $1),
           ins AS (
             INSERT INTO empresas (id, nombre, ruc, telefono, correo, direccion, active, created_at, updated_at)
             SELECT $2, $3, $1, $4, $5, $6, true, NOW(), NOW()
             WHERE NOT EXISTS (SELECT 1 FROM sel)
             RETURNING id, nombre, ruc
           )
      SELECT id, nombre, ruc FROM ins UNION ALL SELECT id, nombre, ruc FROM sel
      `,
      [RUC_EMPRESA, uid('emp'), 'Inmobiliaria Antony S.A.C.', '+51 01 1234567', 'contacto@antony.com', 'Av. Paseo de la República 123, Lima, Perú']
    );
    const empresaId = resEmp.rows[0].id;
    console.log(`[2/5] Empresa OK: id=${empresaId} ruc=${resEmp.rows[0].ruc}`);

    // 2) Upsert Rol ADMIN (unique: empresa_id, nombre)
    const resRolAdmin = await client.query(
      `
      WITH sel AS (SELECT id FROM roles WHERE empresa_id = $1 AND nombre = 'ADMIN'),
           ins AS (
             INSERT INTO roles (id, nombre, descripcion, active, created_at, updated_at, empresa_id)
             SELECT $2, 'ADMIN', 'Acceso total al sistema', true, NOW(), NOW(), $1
             WHERE NOT EXISTS (SELECT 1 FROM sel)
             RETURNING id
           )
      SELECT id FROM ins UNION ALL SELECT id FROM sel
      `,
      [empresaId, uid('rol')]
    );
    const rolAdminId = resRolAdmin.rows[0].id;
    console.log(`[3/5] Rol ADMIN OK: id=${rolAdminId}`);

    // 3) Upsert Rol ASESOR
    await client.query(
      `
      WITH sel AS (SELECT id FROM roles WHERE empresa_id = $1 AND nombre = 'ASESOR')
      INSERT INTO roles (id, nombre, descripcion, active, created_at, updated_at, empresa_id)
      SELECT $2, 'ASESOR', 'Acceso a sus propios registros', true, NOW(), NOW(), $1
      WHERE NOT EXISTS (SELECT 1 FROM sel)
      `,
      [empresaId, uid('rol')]
    );
    console.log('[3b/5] Rol ASESOR OK.');

    // 4) Upsert Usuario ADMIN (unique: empresa_id, correo)
    const resUser = await client.query(
      `
      WITH sel AS (SELECT id, correo, active, empresa_id, rol_id FROM usuarios WHERE empresa_id = $1 AND correo = $2),
           ins AS (
             INSERT INTO usuarios (
               id, nombres, apellidos, correo, password, telefono,
               active, created_at, updated_at, empresa_id, rol_id
             )
             SELECT $3, $4, $5, $2, $6, $7, true, NOW(), NOW(), $1, $8
             WHERE NOT EXISTS (SELECT 1 FROM sel)
             RETURNING id, correo, active, empresa_id, rol_id
           ),
           upd AS (
             UPDATE usuarios
             SET nombres = $4,
                 apellidos = $5,
                 password = $6,
                 telefono = COALESCE($7, usuarios.telefono),
                 active = true,
                 deleted_at = NULL,
                 rol_id = $8,
                 updated_at = NOW()
             WHERE empresa_id = $1 AND correo = $2
             RETURNING id, correo, active, empresa_id, rol_id
           )
      SELECT id, correo, active, empresa_id, rol_id FROM ins
      UNION ALL
      SELECT id, correo, active, empresa_id, rol_id FROM upd
      `,
      [empresaId, ADMIN_CORREO, uid('usr'), 'Administrador', 'Antony', passwordHash, '+51 987 654 321', rolAdminId]
    );
    console.log(`[4/5] Usuario ADMIN OK: id=${resUser.rows[0].id} correo=${resUser.rows[0].correo} activo=${resUser.rows[0].active}`);

    await client.query('COMMIT');
    console.log('========================================');
    console.log(`[5/5] LISTO. Usa estas credenciales en http://localhost:3001/login`);
    console.log(`  CORREO: ${ADMIN_CORREO}`);
    console.log(`  CLAVE : ${ADMIN_PASSWORD}`);
    console.log('========================================');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR SQL ROLLBACK:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
