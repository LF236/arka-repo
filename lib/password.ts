// Política de contraseña (UX). La autoridad es Supabase → Auth → Password
// security: mantener ambas sincronizadas (mín. 8, minúscula, mayúscula, símbolo).
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`,
    test: (pw) => pw.length >= MIN_PASSWORD_LENGTH,
  },
  { id: "lower", label: "Una minúscula", test: (pw) => /\p{Ll}/u.test(pw) },
  { id: "upper", label: "Una mayúscula", test: (pw) => /\p{Lu}/u.test(pw) },
  {
    id: "symbol",
    label: "Un carácter especial (!@#$…)",
    test: (pw) => /[^\p{L}\p{N}\s]/u.test(pw),
  },
];

/** Etiquetas de las reglas que la contraseña aún no cumple. */
export function passwordIssues(pw: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label);
}

/** Mensaje para `weak_password` de Supabase según `reasons` (respaldo). */
export function weakPasswordMessage(err: { reasons?: string[] }): string {
  const reasons = err.reasons ?? [];
  if (reasons.includes("pwned"))
    return "Esa contraseña apareció en filtraciones de datos. Elige otra.";
  if (reasons.includes("characters"))
    return "La contraseña debe incluir minúsculas, mayúsculas y un carácter especial.";
  if (reasons.includes("length"))
    return `La contraseña es muy corta (mínimo ${MIN_PASSWORD_LENGTH} caracteres).`;
  return "La contraseña no cumple los requisitos.";
}
