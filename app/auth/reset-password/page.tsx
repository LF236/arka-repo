"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserContext";
import { createClient } from "@/lib/supabase/client";

function Header() {
  return (
    <div className="auth-header">
      <div className="mark" />
      <h2 className="neon-cyan">ARCADE VAULT</h2>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-faint)",
          letterSpacing: "0.16em",
          marginTop: 6,
        }}
      >
        NUEVA CONTRASEÑA
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const { user, loading: sessionLoading } = useUser();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pass !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({
        password: pass,
      });
      if (error) {
        setError(
          error.code === "weak_password"
            ? "La contraseña es muy débil (mínimo 6 caracteres)."
            : error.code === "same_password"
              ? "La nueva contraseña debe ser distinta a la anterior."
              : "No se pudo actualizar la contraseña. Inténtalo de nuevo.",
        );
        return;
      }
      setPass("");
      setConfirm("");
      router.push("/");
      router.refresh();
    } catch {
      setError("Ocurrió un error. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <Header />

        {sessionLoading ? null : !user ? (
          <div style={{ textAlign: "center" }}>
            <div role="alert" style={{ fontSize: 13, margin: "12px 0 18px" }}>
              Enlace inválido o expirado.
            </div>
            <Link
              href="/auth"
              className="btn ghost"
              style={{ width: "100%", display: "block" }}
            >
              VOLVER A INICIAR SESIÓN
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div
                role="alert"
                style={{
                  fontSize: 12,
                  marginTop: 10,
                  letterSpacing: "0.04em",
                  color: "var(--red, #ff4d6d)",
                }}
              >
                {error}
              </div>
            )}
            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "PROCESANDO…" : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
