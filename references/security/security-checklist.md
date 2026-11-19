## Checklist de seguridad básico

  - [x] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores` (+ REVOKE de grants, SPEC 15)
  - [x] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4). Excepción aceptada: solo plan Pro; revisar al subir de plan
  - [x] Max signup rate — limitar signups por IP (anti-bot): 15/hora por IP
  - [x] Headers de seguridad en Next.js (implementado en `proxy.ts` vía `lib/security-headers.ts`, no en `next.config.ts`)
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el ladod e Supabase:

- [x] Panel de warnings de Supabase revisado (`get_advisors`): solo queda leaked password protection (Free)

