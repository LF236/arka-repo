---
name: audit-state
description: Estado de auditorías de seguridad de Arcade Vault: IDs emitidos, excepciones, falsos positivos
metadata:
  type: project
---

- Última auditoría: 2026-11-18 (DB+App, spec-15 @ 868da32). Bitácora: references/security/audit-log.md.
- IDs emitidos: SEC-001 (next vulnerable, Medio), SEC-002 (TRUNCATE/REFERENCES/TRIGGER grants, Bajo), SEC-003 (/api/contact, Bajo). Próximo: SEC-004.
- Excepción aceptada: auth_leaked_password_protection (plan Free).
- Falso positivo: versión remota de migración security_hardening (20261119012533) difiere del timestamp local (20261118000000); mismo nombre, no es drift.
- Pruebas por rol: usar DO block con `raise exception 'RESULT ...'` para ver resultados (execute_sql solo devuelve el último statement).
- Dev server en localhost:3000 estaba arriba; headers verificados en runtime.
- Checklist: leaked protection se queda `[ ]`.
