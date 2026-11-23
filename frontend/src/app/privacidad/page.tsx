import type { Metadata } from 'next';

const WHATSAPP_URL = 'https://wa.me/51902610409';

export const metadata: Metadata = {
  title: 'Política de privacidad | Dream House',
  description:
    'Información sobre el tratamiento de datos personales por Dream House en sus servicios inmobiliarios y canales de atención.',
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <main className="min-vh-100 px-3 py-5" style={{ background: '#f5f7fb' }}>
      <div className="container" style={{ maxWidth: 920 }}>
        <header className="mb-4">
          <div
            className="d-inline-flex align-items-center gap-2 rounded-pill px-3 py-2 mb-3"
            style={{ background: '#e8eefb', color: '#1f3c88', fontSize: '.82rem', fontWeight: 700 }}
          >
            DREAM HOUSE <span aria-hidden="true">·</span> CHICLAYO, PERÚ
          </div>
          <h1 className="display-6 fw-bold mb-2" style={{ color: '#172554' }}>
            Política de privacidad
          </h1>
          <p className="text-secondary mb-0">Última actualización: 22 de noviembre de 2026</p>
        </header>

        <article className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            <p className="lead">
              En Dream House cuidamos los datos personales que recibimos cuando una persona consulta
              por nuestros inmuebles o utiliza nuestros canales y servicios. Esta política explica
              qué información tratamos, para qué la usamos y cómo puedes ejercer tus derechos.
            </p>

            <div className="alert alert-primary border-0 rounded-3" role="note">
              <strong>Responsable:</strong> Dream House, RUC 20615651533, con operaciones en
              Chiclayo, Perú.
              <br />
              <strong>Canal de privacidad:</strong>{' '}
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                WhatsApp +51 902 610 409
              </a>
            </div>

            <section className="mb-4">
              <h2 className="h4 fw-bold">1. Datos que podemos tratar</h2>
              <p>
                Según la consulta o servicio, podemos tratar nombres y apellidos, número de teléfono,
                correo electrónico, documento de identidad cuando sea necesario, preferencias de
                búsqueda, presupuesto, inmueble o proyecto de interés, solicitudes de visita,
                información de reservas, ventas, pagos o contratos, y el contenido de las
                comunicaciones que nos envíes, incluidos archivos multimedia.
              </p>
              <p className="mb-0">
                Para administrar el CRM también se tratan datos de acceso y perfil de los usuarios
                autorizados, así como información técnica necesaria para mantener la sesión y
                proteger el servicio.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">2. Finalidades</h2>
              <ul>
                <li>Responder consultas sobre inmuebles, proyectos y servicios inmobiliarios.</li>
                <li>Organizar el seguimiento comercial y las solicitudes de visita.</li>
                <li>Gestionar clientes, reservas, ventas y documentación relacionada.</li>
                <li>Administrar el acceso al CRM, brindar soporte y proteger las cuentas.</li>
                <li>Cumplir obligaciones legales y atender solicitudes de las personas titulares.</li>
              </ul>
              <p className="mb-0">
                Cuando solicitemos datos de identidad, como el DNI, explicaremos el motivo y
                solicitaremos el consentimiento correspondiente antes de recopilarlos.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">3. WhatsApp y respuestas asistidas por IA</h2>
              <p>
                Si nos escribes por WhatsApp, Meta procesa la comunicación conforme a sus propias
                condiciones y políticas. El CRM puede almacenar el número, los mensajes, su fecha y,
                si corresponde, archivos multimedia para gestionar la consulta.
              </p>
              <p className="mb-0">
                Cuando la respuesta automática con IA está activa, el mensaje, el historial de la
                conversación y datos del catálogo inmobiliario pueden enviarse a Groq para analizar
                la consulta, preparar una respuesta y apoyar la clasificación comercial. La IA no
                aprueba créditos ni sustituye la atención de un asesor; una persona del equipo puede
                intervenir en la conversación.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">4. Proveedores que prestan el servicio</h2>
              <p>
                Para operar el CRM y sus canales podemos utilizar proveedores tecnológicos que
                procesan datos por cuenta del servicio:
              </p>
              <ul>
                <li>
                  <strong>Meta / WhatsApp:</strong> entrega de mensajes y funcionamiento de la
                  WhatsApp Cloud API.
                </li>
                <li>
                  <strong>Groq:</strong> procesamiento de las conversaciones cuando se utiliza la
                  respuesta asistida por IA.
                </li>
                <li>
                  <strong>Supabase:</strong> base de datos y almacenamiento privado de archivos
                  multimedia, cuando está habilitado.
                </li>
                <li>
                  <strong>Render y Vercel:</strong> alojamiento del backend y del sitio web,
                  respectivamente.
                </li>
              </ul>
              <p className="mb-0">
                Estos proveedores pueden procesar información desde infraestructura ubicada fuera
                del Perú, de acuerdo con sus servicios y condiciones. También podremos comunicar
                datos cuando una obligación legal o una solicitud válida de autoridad competente
                así lo requiera.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">5. Conservación y seguridad</h2>
              <p>
                Conservamos los datos durante el tiempo necesario para atender la consulta, mantener
                la relación comercial y cumplir obligaciones legales o contractuales. Cuando dejan
                de ser necesarios, procuramos suprimirlos o anonimizarlos, salvo que deban conservarse
                por una obligación aplicable.
              </p>
              <p className="mb-0">
                Aplicamos medidas técnicas y organizativas destinadas a proteger la información.
                Ningún medio de transmisión o almacenamiento puede garantizar seguridad absoluta.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">6. Tus derechos y solicitudes</h2>
              <p>
                Puedes solicitar información sobre tus datos, acceder a ellos, pedir su actualización
                o supresión, oponerte a determinados usos y retirar un consentimiento cuando
                corresponda, conforme a la normativa aplicable. Para hacerlo, escríbenos por el
                canal indicado con el asunto “Privacidad de datos”. Podremos pedir información
                razonable para verificar tu identidad y atender la solicitud.
              </p>
              <a className="btn btn-success" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                Contactar por WhatsApp
              </a>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">7. Sesión del CRM</h2>
              <p className="mb-0">
                Cuando una persona autorizada inicia sesión, el CRM utiliza almacenamiento local
                del navegador para mantener su sesión y permitir el uso de las funciones protegidas.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 fw-bold">8. Menores de edad</h2>
              <p className="mb-0">
                Nuestros servicios inmobiliarios y el CRM no están dirigidos a menores de edad. Si
                consideras que un menor nos envió datos personales, contáctanos para revisar el caso.
              </p>
            </section>

            <section>
              <h2 className="h4 fw-bold">9. Cambios a esta política</h2>
              <p className="mb-0">
                Podemos actualizar esta política cuando cambien nuestros servicios o las normas
                aplicables. Publicaremos aquí la versión vigente e indicaremos la fecha de su última
                actualización.
              </p>
            </section>
          </div>
        </article>

        <footer className="text-center text-secondary small mt-4">
          Dream House · RUC 20615651533 · Chiclayo, Perú
        </footer>
      </div>
    </main>
  );
}
