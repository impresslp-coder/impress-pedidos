import { createHmac, timingSafeEqual } from "crypto";

type PrintTokenPayload = {
  pedidoId: string;
  archivoId: string;
  exp: number;
};

function getSecret() {
  const secret =
    process.env.PRINT_JOB_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!secret) {
    throw new Error("Falta PRINT_JOB_SECRET o una clave del servidor para firmar trabajos de impresion");
  }

  return secret;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createPrintToken(pedidoId: string, archivoId: string) {
  const payload: PrintTokenPayload = {
    pedidoId,
    archivoId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPrintToken(token: string): PrintTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PrintTokenPayload;
    if (!payload.pedidoId || !payload.archivoId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
