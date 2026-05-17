import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRootFolderId } from "@/lib/google-drive";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const checks: Record<string, unknown> = {
    email_set: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key_set: !!process.env.GOOGLE_PRIVATE_KEY,
    folder_set: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
  };

  try {
    const folderId = await getRootFolderId();
    checks.drive_ok = true;
    checks.folder_id = folderId;
  } catch (err: unknown) {
    checks.drive_ok = false;
    checks.drive_error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(checks);
}
