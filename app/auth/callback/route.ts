import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Supabase reenvía error_code (p. ej. otp_expired) si el enlace es inválido.
  const failure = new URL("/auth", origin);
  failure.searchParams.set("error", "callback");
  const reason = searchParams.get("error_code");
  if (reason && /^[a-z_]{1,64}$/.test(reason)) {
    failure.searchParams.set("reason", reason);
  }
  return NextResponse.redirect(failure);
}
