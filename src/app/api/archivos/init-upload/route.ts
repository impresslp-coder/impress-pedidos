import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRootFolderId } from "@/lib/google-drive";
import { google } from "googleapis";

function getAuth() {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    return oauth2;
  }
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

// Crea una sesión de subida resumible en Drive y devuelve la URL al cliente
// El cliente sube el archivo directamente a Drive sin pasar por el servidor
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { fileName, pedidoId, mimeType } = await req.json();
  if (!fileName || !pedidoId) return NextResponse.json({ error: "Falta fileName o pedidoId" }, { status: 400 });

  const folderId = await getRootFolderId();
  const auth = getAuth();
  const accessToken = (await (auth as google.auth.OAuth2).getAccessToken()).token;

  // Iniciar sesión de subida resumible
  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": mimeType ?? "application/pdf",
      },
      body: JSON.stringify({
        name: `${pedidoId}_${Date.now()}_${fileName}`,
        parents: [folderId],
        mimeType: mimeType ?? "application/pdf",
      }),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    return NextResponse.json({ error: `Drive init error: ${err}` }, { status: 500 });
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) return NextResponse.json({ error: "No se obtuvo upload URL" }, { status: 500 });

  return NextResponse.json({ uploadUrl, pedidoId, fileName });
}
