import { PASSWORD_RULES } from "@/lib/password";

export default function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul
      aria-label="Requisitos de la contraseña"
      style={{
        listStyle: "none",
        margin: "8px 0 0",
        padding: 0,
        fontSize: 11,
        letterSpacing: "0.04em",
        display: "grid",
        gap: 2,
      }}
    >
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li
            key={r.id}
            style={{
              color: ok ? "var(--cyan, #22e6ff)" : "var(--ink-faint)",
            }}
          >
            {ok ? "✓" : "○"} {r.label}
          </li>
        );
      })}
    </ul>
  );
}
