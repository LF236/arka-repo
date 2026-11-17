import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";

// Refresca la sesión de Supabase y propaga las cookies a request y response.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No ejecutar lógica entre createServerClient y getUser(): refresca el token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión, /auth no tiene sentido: redirigir a `next` (o `/`).
  // Solo la pantalla de login; callback y reset-password siguen accesibles.
  if (user && request.nextUrl.pathname === "/auth") {
    const redirect = NextResponse.redirect(
      new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url),
    );
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
