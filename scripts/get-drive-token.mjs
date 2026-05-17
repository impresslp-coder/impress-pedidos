/**
 * Script de una sola vez para obtener el refresh token de Google Drive.
 * Correr con: node scripts/get-drive-token.mjs
 *
 * Antes de correr, necesitás tener en .env.local:
 *   GOOGLE_OAUTH_CLIENT_ID=...
 *   GOOGLE_OAUTH_CLIENT_SECRET=...
 */

import { readFileSync } from "fs";
import { createServer } from "http";
import { URL } from "url";
import { google } from "googleapis";

// Leer .env.local manualmente
const env = {};
try {
  const lines = readFileSync(".env.local", "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k && v.length) env[k.trim()] = v.join("=").trim();
  }
} catch {}

const CLIENT_ID = env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3999/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n❌ Faltan GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en .env.local\n");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\n🔗 Abrí esta URL en el browser:\n");
console.log(authUrl);
console.log("\nDespués de autorizar, vas a ver el token acá abajo.\n");

// Mini servidor para capturar el callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3999");
  if (url.pathname !== "/callback") { res.end(); return; }

  const code = url.searchParams.get("code");
  if (!code) { res.end("Sin código"); return; }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end("<h1>✅ Token obtenido. Revisá la terminal.</h1>");
    server.close();

    console.log("\n✅ Agregá esto a tu .env.local:\n");
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\n⚠️  Guardalo bien — este refresh token no vence (a menos que revoques el acceso).\n");
  } catch (err) {
    res.end("Error: " + err.message);
    console.error(err);
    server.close();
  }
});

server.listen(3999, () => {
  console.log("⏳ Esperando callback en http://localhost:3999...\n");
});
