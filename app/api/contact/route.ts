import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY no configurada en el servidor." },
      { status: 500 }
    );
  }

  const { name, email, msg } = await req.json();

  if (!name?.trim() || !email?.trim() || !msg?.trim()) {
    return NextResponse.json(
      { error: "Todos los campos son requeridos." },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "fernandorodriguez236@gmail.com",
    replyTo: email.trim(),
    subject: `[Arcade Vault] Mensaje de ${name.trim()}`,
    text: `Nombre: ${name.trim()}\nCorreo: ${email.trim()}\n\n${msg.trim()}`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
