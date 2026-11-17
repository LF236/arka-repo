"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Solo rutas relativas (/…), nunca // ni /\ (anti open-redirect).
function safeNext(next: string | null): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return "/";
}

function authErrorMessage(err: AuthError): string {
  switch (err.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Debes verificar tu correo antes de iniciar sesión.";
    case "user_already_exists":
    case "email_exists":
      return "Ese correo ya está registrado.";
    case "weak_password":
      return "La contraseña es muy débil (mínimo 6 caracteres).";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    default:
      return "Ocurrió un error. Inténtalo de nuevo.";
  }
}

function AuthForm() {
  const [tab, setTab] = useState<"in" | "up" | "reset">("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const callbackError = params.get("error") === "callback";
  const callbackNotice =
    params.get("reason") === "otp_expired"
      ? "El enlace caducó o ya fue usado. Inicia sesión o solicita uno nuevo."
      : "Si ya verificaste tu correo, inicia sesión con tu correo y contraseña. Si no, solicita un enlace nuevo.";

  const clearFields = () => {
    setUsername("");
    setEmail("");
    setPass("");
  };

  const switchTab = (t: "in" | "up" | "reset") => {
    setTab(t);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (tab === "reset") {
        const redirectTo = new URL("/auth/callback", window.location.origin);
        redirectTo.searchParams.set("next", "/auth/reset-password");
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirectTo.toString() },
        );
        if (error) {
          setError(authErrorMessage(error));
          return;
        }
        setNotice(
          "Si el correo está registrado, recibirás un enlace para recuperar tu contraseña.",
        );
        clearFields();
      } else if (tab === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pass,
        });
        if (error) {
          setError(authErrorMessage(error));
          return;
        }
        clearFields();
        router.push(next);
        router.refresh();
      } else {
        const callback = new URL("/auth/callback", window.location.origin);
        if (next !== "/") callback.searchParams.set("next", next);
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pass,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: callback.toString(),
          },
        });
        if (error) {
          setError(authErrorMessage(error));
          return;
        }
        // Email ya registrado: Supabase devuelve un usuario sin identities.
        if (data.user && data.user.identities?.length === 0) {
          setError("Ese correo ya está registrado.");
          return;
        }
        setNotice("Revisa tu correo para verificar tu cuenta.");
        clearFields();
      }
    } catch {
      setError("Ocurrió un error. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    setNotice(null);
    setLoading(true);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setError(authErrorMessage(error));
      setLoading(false);
    }
    // Sin error: el navegador redirige al provider.
  };

  const guest = () => {
    router.push("/");
  };

  const msgStyle = {
    fontSize: 12,
    marginTop: 10,
    letterSpacing: "0.04em",
  } as const;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
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
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {tab === "reset" ? (
          <div
            className="mono"
            style={{
              fontSize: 12,
              letterSpacing: "0.12em",
              textAlign: "center",
              margin: "4px 0 14px",
            }}
          >
            RECUPERAR CONTRASEÑA
          </div>
        ) : (
          <div className="auth-tabs">
            <button
              className={tab === "in" ? "on" : ""}
              onClick={() => switchTab("in")}
            >
              INICIAR SESIÓN
            </button>
            <button
              className={tab === "up" ? "on" : ""}
              onClick={() => switchTab("up")}
            >
              CREAR CUENTA
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
                required
                maxLength={20}
              />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              required
              autoComplete="email"
            />
          </div>
          {tab !== "reset" && (
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={
                  tab === "in" ? "current-password" : "new-password"
                }
              />
            </div>
          )}
          {tab === "in" && (
            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", marginTop: 4 }}
              onClick={() => switchTab("reset")}
            >
              ¿OLVIDASTE TU CONTRASEÑA?
            </button>
          )}
          {error && (
            <div
              role="alert"
              style={{ ...msgStyle, color: "var(--red, #ff4d6d)" }}
            >
              {error}
            </div>
          )}
          {(notice || (callbackError && !error)) && (
            <div
              role="status"
              style={{ ...msgStyle, color: "var(--cyan, #22e6ff)" }}
            >
              {notice ?? callbackNotice}
            </div>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading
              ? "PROCESANDO…"
              : tab === "reset"
                ? "ENVIAR ENLACE"
                : tab === "in"
                  ? "ENTRAR AL VAULT"
                  : "CREAR CUENTA"}
          </button>
        </form>

        {tab === "reset" ? (
          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => switchTab("in")}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        ) : (
          <>
            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={guest}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                disabled={loading}
                onClick={() => oauth("google")}
              >
                ◆ GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={loading}
                onClick={() => oauth("github")}
              >
                ▣ GITHUB
              </button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

export default function Auth() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
