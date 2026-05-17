import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const ROOT_FOLDER_NAME = "Impress-Pedidos";

function getAuth() {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN.trim() });
    return oauth2;
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  if (serviceAccountEmail && privateKey) {
    return new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: SCOPES,
    });
  }

  throw new Error("Faltan credenciales de Google Drive");
}

export async function getRootFolderId(): Promise<string> {
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
  }

  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files?.length) {
    return res.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return folder.data.id!;
}

export async function uploadPDF(fileBuffer: Buffer, fileName: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = await getRootFolderId();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(fileBuffer),
    },
    fields: "id",
  });

  return res.data.id!;
}

export async function downloadPDF(fileId: string): Promise<Buffer> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(res.data as ArrayBuffer);
}
