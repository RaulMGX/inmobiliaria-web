require('dotenv').config({ path: ['.env.local', '.env'] });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const RUC_EMPRESA = '20123456789';
const ASESOR_PASSWORD = 'Asesor123$';
const ASESOR_CORREO = 'asesor@antony.com';
const PROYECTO_NOMBRE = 'Condominio Las Palmeras';
const PROPIEDAD_CODIGO = 'PALM-101';

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
    const passwordHash = await bcrypt.hash(ASESOR_PASSWORD, 12);
    await client.query('BEGIN');

    const resEmp = await client.query(`SELECT id FROM empresas WHERE ruc = $1`, [RUC_EMPRESA]);
    if (resEmp.rows.length === 0) {
      throw new Error(`No existe empresa con RUC ${RUC_EMPRESA}. Ejecuta primero node scripts/seed-admin-pg.cjs`);
    }
    const empresaId = resEmp.rows[0].id;
    console.log(`[1/6] Empresa OK id=${empresaId}`);

    const resRolAs = await client.query(
      `WITH sel AS (SELECT id FROM roles WHERE empresa_id = $1 AND nombre = 'ASESOR'),
            ins AS (INSERT INTO roles (id, nombre, descripcion, active, created_at, updated_at, empresa_id)
                    SELECT $2, 'ASESOR', 'Acceso a sus propios registros', true, NOW(), NOW(), $1
                    WHERE NOT EXISTS (SELECT 1 FROM sel) RETURNING id)
       SELECT id FROM ins UNION ALL SELECT id FROM sel`,
      [empresaId, uid('rol')],
    );
    const rolAsesorId = resRolAs.rows[0].id;
    console.log(`[2/6] Rol ASESOR OK id=${rolAsesorId}`);

    const resUsr = await client.query(
      `WITH sel AS (SELECT id, correo FROM usuarios WHERE empresa_id = $1 AND correo = $2),
            ins AS (INSERT INTO usuarios (id, nombres, apellidos, correo, password, telefono,
                                          active, created_at, updated_at, empresa_id, rol_id)
                    SELECT $3, 'Carla', 'Gómez', $2, $4, '+51 955 111 222',
                           true, NOW(), NOW(), $1, $5
                    WHERE NOT EXISTS (SELECT 1 FROM sel) RETURNING id, correo),
            upd AS (UPDATE usuarios SET nombres='Carla', apellidos='Gómez', password=$4,
                          telefono='+51 955 111 222', active=true, deleted_at=NULL, rol_id=$5, updated_at=NOW()
                    WHERE empresa_id = $1 AND correo = $2 RETURNING id, correo)
       SELECT id, correo FROM ins UNION ALL SELECT id, correo FROM upd`,
      [empresaId, ASESOR_CORREO, uid('usr'), passwordHash, rolAsesorId],
    );
    console.log(`[3/6] Usuario ASESOR OK correo=${ASESOR_CORREO} clave=${ASESOR_PASSWORD}`);

    const resProy = await client.query(
      `WITH sel AS (SELECT id FROM proyectos WHERE empresa_id = $1 AND nombre = $2),
            ins AS (INSERT INTO proyectos (id, nombre, descripcion, tipo_proyecto, estado, fecha_inicio,
                                           direccion, distrito, ciudad, active, created_at, updated_at, empresa_id)
                    SELECT $3, $2, 'Proyecto residencial 3 torres con piscina y areas verdes', 'DEPARTAMENTOS',
                           'ACTIVO', CURRENT_DATE, 'Av. La Encalada 1230', 'Santiago de Surco', 'Lima',
                           true, NOW(), NOW(), $1
                    WHERE NOT EXISTS (SELECT 1 FROM sel) RETURNING id)
       SELECT id FROM ins UNION ALL SELECT id FROM sel`,
      [empresaId, PROYECTO_NOMBRE, uid('proy')],
    );
    const proyectoId = resProy.rows[0].id;
    console.log(`[4/6] Proyecto OK id=${proyectoId} nombre=${PROYECTO_NOMBRE}`);

    const resProp = await client.query(
      `WITH sel AS (SELECT id FROM propiedades WHERE codigo_interno = $1),
            ins AS (INSERT INTO propiedades (id, codigo_interno, nombre, tipo_propiedad, estado, precio,
                                             area_total, area_construida, habitaciones, banos, estacionamientos,
                                             piso, direccion, descripcion, active, created_at, updated_at, proyecto_id)
                    SELECT $2, $1, 'Departamento 101 - Torre A', 'DEPARTAMENTO', 'DISPONIBLE', 250000.00,
                           85.50, 78.00, 3, 2, 1, 1, 'Av. La Encalada 1230 - Dpto 101',
                           'Dpto. 3 habitaciones, 2 baños, cocina integrada, vista al parque.',
                           true, NOW(), NOW(), $3
                    WHERE NOT EXISTS (SELECT 1 FROM sel) RETURNING id),
            upd AS (UPDATE propiedades SET nombre='Departamento 101 - Torre A', estado='DISPONIBLE',
                          precio=250000.00, proyecto_id=$3, updated_at=NOW()
                    WHERE codigo_interno = $1 RETURNING id)
       SELECT id FROM ins UNION ALL SELECT id FROM upd`,
      [PROPIEDAD_CODIGO, uid('prop'), proyectoId],
    );
    console.log(`[5/6] Propiedad OK codigo=${PROPIEDAD_CODIGO} id=${resProp.rows[0].id}`);

    await client.query('COMMIT');
    console.log('[6/6] LISTO. ASESOR listo para probar el flujo.');
    console.log(`  CORREO: ${ASESOR_CORREO}`);
    console.log(`  CLAVE : ${ASESOR_PASSWORD}`);
    console.log(`  PROYECTO: ${PROYECTO_NOMBRE} (id=${proyectoId})`);
    console.log(`  PROPIEDAD: ${PROPIEDAD_CODIGO} (id=${resProp.rows[0].id})`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR SQL ROLLBACK:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
