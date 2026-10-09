const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const EMPRESA_ID = 'emp_seed_admin_001';
const ROL_ADMIN_ID = 'rol_seed_admin_001';
const ROL_ASESOR_ID = 'rol_seed_asesor_001';
const USUARIO_ADMIN_ID = 'usr_seed_admin_001';

const ADMIN_PASSWORD = 'Admin123$';
const ADMIN_CORREO = 'admin@antony.com';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  console.log(`[1/5] Password hash generado para "${ADMIN_PASSWORD}".`);

  const empresa = await prisma.empresa.upsert({
    where: { ruc: '20123456789' },
    create: {
      id: EMPRESA_ID,
      nombre: 'Inmobiliaria Antony S.A.C.',
      ruc: '20123456789',
      telefono: '+51 01 1234567',
      correo: 'contacto@antony.com',
      direccion: 'Av. Paseo de la República 123, Lima, Perú',
      active: true,
    },
    update: {
      nombre: 'Inmobiliaria Antony S.A.C.',
      telefono: '+51 01 1234567',
      correo: 'contacto@antony.com',
      direccion: 'Av. Paseo de la República 123, Lima, Perú',
      active: true,
      deletedAt: null,
    },
  });
  console.log(`[2/5] Empresa OK: id=${empresa.id} ruc=${empresa.ruc}`);

  const rolAdmin = await prisma.rol.upsert({
    where: { empresaId_nombre: { empresaId: empresa.id, nombre: 'ADMIN' } },
    create: {
      id: ROL_ADMIN_ID,
      nombre: 'ADMIN',
      descripcion: 'Acceso total al sistema',
      empresaId: empresa.id,
      active: true,
    },
    update: {
      descripcion: 'Acceso total al sistema',
      active: true,
      deletedAt: null,
    },
  });
  console.log(`[3/5] Rol ADMIN OK: id=${rolAdmin.id}`);

  await prisma.rol.upsert({
    where: { empresaId_nombre: { empresaId: empresa.id, nombre: 'ASESOR' } },
    create: {
      id: ROL_ASESOR_ID,
      nombre: 'ASESOR',
      descripcion: 'Acceso a sus propios registros',
      empresaId: empresa.id,
      active: true,
    },
    update: {
      descripcion: 'Acceso a sus propios registros',
      active: true,
      deletedAt: null,
    },
  });
  console.log(`[3b/5] Rol ASESOR OK.`);

  const usuarioAdmin = await prisma.usuario.upsert({
    where: { empresaId_correo: { empresaId: empresa.id, correo: ADMIN_CORREO } },
    create: {
      id: USUARIO_ADMIN_ID,
      nombres: 'Administrador',
      apellidos: 'Antony',
      correo: ADMIN_CORREO,
      password: passwordHash,
      telefono: '+51 987 654 321',
      active: true,
      empresaId: empresa.id,
      rolId: rolAdmin.id,
    },
    update: {
      nombres: 'Administrador',
      apellidos: 'Antony',
      password: passwordHash,
      telefono: '+51 987 654 321',
      active: true,
      deletedAt: null,
      rolId: rolAdmin.id,
    },
  });
  console.log(`[4/5] Usuario ADMIN OK: id=${usuarioAdmin.id} correo=${usuarioAdmin.correo} activo=${usuarioAdmin.active}`);
  console.log('========================================');
  console.log(`[5/5] LISTO. Usa estas credenciales en http://localhost:3001/login`);
  console.log(`  CORREO: ${ADMIN_CORREO}`);
  console.log(`  CLAVE : ${ADMIN_PASSWORD}`);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('ERROR en seed-admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
