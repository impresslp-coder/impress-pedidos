import { readFile, writeFile } from "node:fs/promises";

const credentialsPath = process.argv[2];
if (!credentialsPath) throw new Error("Indicá la ruta al JSON de la cuenta de servicio.");

const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
if (credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) {
  throw new Error("El archivo no contiene credenciales válidas de una cuenta de servicio.");
}

const envPath = ".env.local";
const source = await readFile(envPath, "utf8");
const updates = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: credentials.client_email,
  GOOGLE_PRIVATE_KEY: JSON.stringify(credentials.private_key),
};

let output = source;
for (const [key, value] of Object.entries(updates)) {
  const expression = new RegExp(`^${key}=.*$`, "m");
  output = expression.test(output) ? output.replace(expression, `${key}=${value}`) : `${output.trimEnd()}\n${key}=${value}\n`;
}

await writeFile(envPath, output, "utf8");
console.log("Credenciales de Google actualizadas en .env.local sin mostrar valores sensibles.");
