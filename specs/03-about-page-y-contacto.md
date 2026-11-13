# SPEC 03 — About Page y Formulario de Contacto con Resend

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-07
> **Objective:** Implementar la página `/acerca` usando el template `references/templates/home-about/about.jsx` y conectar su formulario de contacto a Resend para enviar correos reales.

---

## Scope

**In:**

- `app/acerca/page.tsx` — nueva página About (Client Component), fiel al template
- `app/api/contact/route.ts` — API route que recibe el form y llama a Resend
- `.env.local` — variable `RESEND_API_KEY` (no se commitea)
- `.env.template` — añadir entrada `RESEND_API_KEY=` como documentación
- `components/Nav.tsx` — activar el link "Acerca de" (ya existe como placeholder en `/acerca`)

**Out of scope:**

- Verificación de dominio propio en Resend (queda para producción)
- Email de confirmación enviado al usuario que llena el formulario
- Persistencia de mensajes en base de datos
- Rate limiting o CAPTCHA
- Tests automatizados

---

## Data model

No se introducen estructuras en `lib/data.ts`. Todo es local al componente y la API route.

Estado del formulario en el cliente:

```ts
// Estado local en app/acerca/page.tsx
const [form, setForm] = useState({ name: "", email: "", msg: "" });
const [sent, setSent]   = useState<string | null>(null);   // nombre del remitente al confirmar
const [error, setError] = useState<string | null>(null);   // mensaje de error de API
const [shake, setShake] = useState(false);                 // animación de validación
const [loading, setLoading] = useState(false);             // submit en curso
```

Payload del API route:

```ts
// POST /api/contact
// Body: { name: string; email: string; msg: string }
// 200 → { ok: true }
// 500 → { error: string }
```

Configuración de Resend:

| Campo     | Valor                          | Razón                                              |
|-----------|--------------------------------|----------------------------------------------------|
| `from`    | `onboarding@resend.dev`        | Remitente sandbox de Resend (sin verificar dominio)|
| `to`      | `fernandorodriguez236@gmail.com` | Bandeja donde llegan los mensajes                |
| `replyTo` | email del formulario           | Responder al visitante directamente                |
| `subject` | `[Arcade Vault] Mensaje de {name}` | Identificable en la bandeja                   |

---

## Implementation plan

1. **Instalar `resend`** — `npm install resend`. Verificación: `package.json` incluye `resend`.

2. **Añadir `RESEND_API_KEY` al entorno** — Crear entrada en `.env.local` (no commitear). Añadir línea `RESEND_API_KEY=` a `.env.template`. Verificación: `process.env.RESEND_API_KEY` disponible en la API route.

3. **Crear `app/api/contact/route.ts`** — Leer `name`, `email`, `msg` del body. Validar que los tres existen (400 si falta alguno). Llamar a Resend con la config de la tabla anterior. Devolver `{ ok: true }` en 200 o `{ error: "..." }` en 500. Verificación: `curl -X POST /api/contact` con body válido retorna 200; con body vacío retorna 400.

4. **Crear `app/acerca/page.tsx`** — `'use client'`. Implementar:
   - `HighlightIcon` — renders SVG por `kind` ("HEART", "BROWSER", "PLANT"), copiados del template.
   - `useReveal()` — mismo hook que en `app/page.tsx` (IntersectionObserver + clase `in`).
   - `About` — componente principal con:
     - Sección `.about-hero`: kicker, título, misión, `highlight-row` con 3 `HighlightIcon`.
     - Divisor `.about-divider` con 24 `<span>` de pixel art.
     - Sección `.about-contact`: intro con kicker, título, párrafo y tips; form con los 3 campos.
   - `onSubmit`: valida campos, pone `loading=true`, llama `POST /api/contact`, en éxito pone `setSent(name)`, en error pone `setError("No se pudo enviar. Intenta de nuevo.")`.
   - Estado `sent`: muestra el bloque `.terminal-success` exacto del template (con el nombre en `{sent.toUpperCase()}`).
   - Estado `error`: muestra un párrafo de error debajo del botón antes de que el usuario reintente.
   - Estado `loading`: el botón muestra `▶  ENVIANDO…` y queda deshabilitado.
   - Animación `shake` cuando se intenta enviar con campos vacíos.
   Verificación: `/acerca` renderiza ambas secciones; el form acepta entrada y el botón cambia a "ENVIANDO…" al hacer submit.

5. **Actualizar `components/Nav.tsx`** — Cambiar el link "Acerca de" de placeholder sin `active` a que active cuando `pathname === '/acerca'`. Sin otros cambios. Verificación: el link "Acerca de" resalta con la clase `active` al estar en `/acerca`.

---

## Acceptance criteria

- [ ] `/acerca` carga sin errores y muestra el título "ACERCA DE ARCADE VAULT"
- [ ] La sección hero muestra los 3 highlight-cards con sus íconos SVG (HEART, BROWSER, PLANT) y textos del template
- [ ] El divisor de pixel art es visible entre las dos secciones
- [ ] La sección de contacto muestra el formulario con los 3 campos: Nombre, Correo Electrónico, Mensaje
- [ ] Intentar enviar con campos vacíos activa la animación `shake` y no llama a la API
- [ ] El botón muestra `▶  ENVIANDO…` y queda deshabilitado mientras la petición está en curso
- [ ] Un submit válido envía un correo real a `fernandorodriguez236@gmail.com` vía Resend
- [ ] Tras envío exitoso, el formulario es reemplazado por el bloque `.terminal-success` con el nombre del remitente
- [ ] El botón "ENVIAR OTRO MENSAJE" limpia el estado y vuelve al formulario vacío
- [ ] Si la API retorna error, se muestra un mensaje de error en el form y el usuario puede reintentar
- [ ] El link "Acerca de" del Nav activa la clase `active` al estar en `/acerca`
- [ ] Las secciones con `.reveal` se animan al hacer scroll
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisions

- **Sí: `onboarding@resend.dev` como remitente** — Gmail no es un dominio verificable en Resend sin configuración adicional. El sandbox de Resend usa este remitente sin restricciones; `replyTo` apunta al email del visitante para que se pueda responder directamente.
- **Sí: `fernandorodriguez236@gmail.com` como destinatario** — Decisión del usuario.
- **Sí: estado `loading` en el botón** — El template original simula éxito localmente; aquí hay latencia real de red. Sin indicador de carga el UX se siente roto.
- **Sí: estado `error` explícito** — Decisión del usuario. El usuario debe saber si el envío falló y poder reintentar.
- **No: confirmación al visitante** — Fuera de scope; añadiría complejidad de template de email y no fue solicitado.
- **No: rate limiting** — Fuera de scope para MVP. Resend tiene sus propios límites en el plan gratuito.
- **No: persistir mensajes en BD** — Los correos son el registro suficiente para este MVP.

---

## Risks

| Riesgo | Mitigación |
|--------|------------|
| `RESEND_API_KEY` ausente en producción bloquea el envío silenciosamente | La API route verifica su existencia y retorna 500 con mensaje claro si no está definida |
| Resend rechaza `onboarding@resend.dev` fuera de cuentas nuevas | Si falla, agregar dominio propio verificado; el spec localiza el cambio en un solo campo de `route.ts` |
| CSS de `.about-*` no migrado en SPEC 01 | El paso 4 lo detecta en desarrollo; añadir las reglas faltantes antes de continuar |
