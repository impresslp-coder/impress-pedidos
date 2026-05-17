import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UsuariosManager from "./usuarios-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") redirect("/");

  const { data: usuarios } = await admin
    .from("usuarios_sistema")
    .select("*")
    .order("nombre");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Usuarios del sistema</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Para invitar usuarios nuevos:{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:underline">
            Supabase → Authentication → Users → Invite
          </a>
        </p>
      </div>
      <UsuariosManager usuarios={usuarios ?? []} />
    </div>
  );
}
