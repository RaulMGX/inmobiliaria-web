# Debug Session: whatsapp-ai-no-reply
- **Status**: [OPEN]
- **progress_status**: collecting
- **Issue**: El usuario envía mensajes al número de WhatsApp del CRM, pero la IA no responde.
- **Evidence Source**: HTTP Debug Server probe and Render runtime logs
- **Evidence Directory**: C:\Users\LENOVO\AppData\Local\Temp\trae-debug\crm-antony\whatsapp-ai-no-reply
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: C:\Users\LENOVO\AppData\Local\Temp\trae-debug\crm-antony\whatsapp-ai-no-reply\trae-debug-log-whatsapp-ai-no-reply.ndjson

## Reproduction Steps
1. Desde otro número de WhatsApp, enviar un mensaje nuevo al número Cloud API `+51 902 610 409`.
2. Confirmar si aparece respuesta automática.
3. Revisar los logs de Render en el mismo intervalo.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `GROQ_API_KEY` está ausente o inválida en Render y bloquea la IA. | High | Low | CONFIRMED PRESENT: Render Environment muestra la variable y el despliegue se completó; validez de la clave no confirmada. |
| B | Meta no está entregando el evento `messages` al webhook de Render. | Medium | Medium | CONFIRMED: Meta indica que las apps no publicadas solo reciben webhooks de prueba y no datos de producción. El usuario confirma `messages` como Suscrito y el callback apunta al endpoint del backend; el panel de la app previamente mostraba estado "Sin publicar". |
| C | El `phone_number_id` del evento de Meta no coincide con el configurado en la empresa. | Medium | Medium | El código omite la respuesta si no resuelve una empresa y registra un warning; falta evidencia de runtime. |
| D | La conversación existente está en modo humano o con IA desactivada. | Medium | Low | El código solo responde si `modoAtencion === 'IA' && iaActiva`; no existe bandeja WhatsApp visible en el frontend inspeccionado. |
| E | El token de WhatsApp o permisos impiden enviar la respuesta a Meta. | Medium | Medium | El envío captura errores Graph API; no se han obtenido logs de este intento. |

## Log Evidence
- Captura de WhatsApp: mensaje nuevo “Prueba de ia” enviado alrededor de 3:49 p. m.; no aparece respuesta.
- Captura de Render: despliegue por actualización de variables terminó con `Deploy succeeded | Live` alrededor de 3:46 p. m.
- Render Environment muestra filas para `GROQ_API_KEY` y `WHATSAPP_ACCESS_TOKEN`; no se leyó ni reveló ningún valor secreto.
- Logs de Render (11/22/2026 3:47:44-3:52:48 p. m.): aplicación inició y mapeó `POST /api/v1/whatsapp/webhook`; no hay errores del webhook, Groq ni Graph API. No hay logs por solicitud exitosa y `Request logs` está deshabilitado, por lo que la ausencia de entradas no prueba que Meta no haya entregado el mensaje.
- Render Environment confirma filas `GROQ_API_KEY` y `WHATSAPP_ACCESS_TOKEN`; los valores permanecen ocultos y no fueron leídos.
- Una consulta SQL de solo lectura no pudo autenticar usando las credenciales locales; no se consultó ni modificó la base de datos.
- Health check público `https://crm-antoni-api.onrender.com/api/v1/health` devolvió HTTP 200 y `{"status":"ok"}`.
- El usuario inició sesión en Meta Business Suite en el navegador de diagnóstico; falta devolver el control para inspeccionar suscripciones/entregas.
- Meta Developer dashboard abierto para la app "DreamHouse CRM" (App ID 1669350628183524). Se localizó el panel Webhooks; una primera vista mostraba `User` seleccionado y `Whatsapp Business Account` disponible en la lista. Luego el usuario compartió la configuración del objeto de WhatsApp, confirmando callback y suscripción a `messages`.
- El usuario comparte la configuración del objeto WhatsApp Business Account: callback `https://crm-antoni-api.onrender.com/api/v1/whatsapp/webhook`, campo `messages` en estado `Suscrito` y token de verificación presente (oculto). Meta advierte en la misma pantalla que las apps no publicadas solo reciben webhooks de prueba y no datos de producción; el panel de la app mostraba `Sin publicar`. Esto confirma que el modo no publicado bloquea la entrega de mensajes reales.
- Captura de la página Publicar: el estado de la app es `Sin publicar`, falta la URL de política de privacidad y el botón `Publicar` está deshabilitado. Los casos de uso listados son WhatsApp e Instagram. La búsqueda local no encontró una página/URL existente de privacidad en el proyecto.
- Se creó `frontend/src/app/privacidad/page.tsx` con una página pública informativa; `npm run build` terminó correctamente y generó `/privacidad`. El lint específico no pudo ejecutarse porque ESLint 9 no encuentra `eslint.config.*`. La URL pública `https://inmobiliaria-web-puce.vercel.app/privacidad` todavía devuelve HTTP 404, por lo que el cambio local aún no está desplegado.
- El usuario autorizó desplegar la página. No se desplegó aún: Vercel CLI quedó `Logged out` y el dashboard requiere inicio de sesión. El workspace también contiene otros cambios locales (incluidas varias páginas del frontend); se evitó publicar el proyecto completo sin autorización específica.
- El usuario autorizó desplegar el frontend completo y autenticó Vercel CLI mediante el flujo de autorización del dispositivo. La cuenta autenticada (`raul-96f3`) solo muestra el proyecto `antony`, cuyo único dominio asignado es `antony-beige.vercel.app`; no muestra `inmobiliaria-web-puce.vercel.app`. Ambos dominios responden HTTP 200, pero muestran títulos distintos. Se pausó antes del despliegue para confirmar el destino correcto.
- Recolector HTTP local iniciado y comprobado: `/health` devolvió `status=ok`; evento de prueba guardado en el NDJSON externo.
- Inspección estática: `whatsapp.service.ts` solo invoca Groq para conversaciones con IA activa; `groq.service.ts` requiere `GROQ_API_KEY`.
- Inspección estática: la aplicación frontend no contiene una página/bandeja de conversaciones WhatsApp.

## Verification Conclusion
El bloqueo de entrega de producción por app no publicada está confirmado; el webhook está correctamente configurado para `messages`. Se creó la página de privacidad localmente, pero no está desplegada en Vercel. Después del despliegue y de revisar/publicar la app en Meta, se deberá reproducir un mensaje real; la validez de Groq y el estado de IA en empresa/conversación siguen pendientes.

## Final Evidence Gate
- **Evidence Sources**: Configuración Webhooks y página Publicar de Meta compartidas por el usuario; build local de Next.js; respuesta HTTP 404 del dominio Vercel; Render Environment y Logs; `C:\Users\LENOVO\AppData\Local\Temp\trae-debug\crm-antony\whatsapp-ai-no-reply\trae-debug-log-whatsapp-ai-no-reply.ndjson`.
- **progress_status**: awaiting_confirmation_of_correct_vercel_project_and_production_domain
- **Hypothesis Conclusions**: A INCONCLUSIVE (variable presente, credencial no validada); B CONFIRMED (la app no publicada no recibe datos de producción); C INCONCLUSIVE; D INCONCLUSIVE; E INCONCLUSIVE.
