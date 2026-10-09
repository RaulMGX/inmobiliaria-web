const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const a = await bcrypt.hash('Admin123$', 10);
    const b = await bcrypt.hash('Asesor123$', 10);
    const sql = `
-- ========================================================
-- SEEDS CRM ANTONY (datos reales | bcrypt 10 rounds)
-- Campos exactos usados por PRISMA + scripts seeders originales
-- ========================================================

-- 1) Empresa demo
INSERT INTO empresas (id, nombre, ruc, telefono, correo, direccion, active, created_at, updated_at)
VALUES ('emp_demo_001', 'Inmobiliaria Antony S.A.C.', '20123456789', '+51 01 1234567', 'contacto@antony.com', 'Av. Paseo de la República 123, Lima, Perú', true, NOW(), NOW())
ON CONFLICT (ruc) DO NOTHING;

-- 2) Roles ADMIN / ASESOR
INSERT INTO roles (id, nombre, descripcion, active, created_at, updated_at, empresa_id) VALUES
  ('rol_demo_admin', 'ADMIN', 'Acceso total al sistema', true, NOW(), NOW(), 'emp_demo_001'),
  ('rol_demo_asesor', 'ASESOR', 'Acceso a sus propios registros', true, NOW(), NOW(), 'emp_demo_001')
ON CONFLICT (empresa_id, nombre) DO NOTHING;

-- 3) Usuarios bcrypt REAL - Login con:
--    📧 admin@antony.com   🔑 Admin123$
--    📧 asesor@antony.com  🔑 Asesor123$
INSERT INTO usuarios (id, nombres, apellidos, correo, password, telefono, active, created_at, updated_at, empresa_id, rol_id) VALUES
  ('usr_demo_admin', 'Administrador', 'Antony', 'admin@antony.com',
   '${a}', '+51 987 654 321', true, NOW(), NOW(), 'emp_demo_001', 'rol_demo_admin'),
  ('usr_demo_asesor', 'Raul kelvin', 'Mendoza guevara', 'asesor@antony.com',
   '${b}', '+51 980 123 456', true, NOW(), NOW(), 'emp_demo_001', 'rol_demo_asesor')
ON CONFLICT (empresa_id, correo) DO NOTHING;

-- 4) Proyecto demo Condominio Las Palmeras
INSERT INTO proyectos (id, nombre, descripcion, tipo_proyecto, estado, fecha_inicio,
                       direccion, distrito, ciudad, active, created_at, updated_at, empresa_id)
VALUES ('proy_demo_01', 'Condominio Las Palmeras',
        'Proyecto residencial 3 torres con piscina y areas verdes.',
        'DEPARTAMENTOS', 'ACTIVO', CURRENT_DATE,
        'Av. La Encalada 1230', 'Santiago de Surco', 'Lima',
        true, NOW(), NOW(), 'emp_demo_001')
ON CONFLICT (empresa_id, nombre) DO NOTHING;

-- 5) Propiedad PALM-101
INSERT INTO propiedades (id, codigo_interno, nombre, tipo_propiedad, estado, precio,
                         area_total, area_construida, habitaciones, banos, estacionamientos,
                         piso, direccion, descripcion, active, created_at, updated_at, proyecto_id)
VALUES ('prop_demo_101', 'PALM-101', 'Departamento 101 - Torre A',
        'DEPARTAMENTO', 'DISPONIBLE', 250000.00,
        85.50, 78.00, 3, 2, 1, 1,
        'Av. La Encalada 1230 - Dpto 101',
        'Dpto 3 habitaciones, 2 baños, cocina integrada, vista al parque.',
        true, NOW(), NOW(), 'proy_demo_01')
ON CONFLICT (codigo_interno) DO NOTHING;
`;
    const out = path.join(__dirname, 'supabase-seeds.sql');
    fs.writeFileSync(out, sql, 'utf8');
    console.log('✅ Seeds bcrypt OK:', out);
    console.log('HASH Admin123$: ', a.slice(0, 32) + '...');
    console.log('HASH Asesor123$:', b.slice(0, 32) + '...');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
