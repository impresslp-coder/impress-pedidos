import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { UploadProvider } from "./upload-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  const esAdmin = perfil?.rol === "admin";

  const navLinks = [
    { href: "/pedidos", label: "Pedidos" },
    { href: "/encargos", label: "Encargos" },
    { href: "/ventas", label: "Ventas" },
    { href: "/presupuestos/nuevo", label: "Presupuesto" },
    { href: "/reclamos", label: "Reclamos" },
    { href: "/productos", label: "Productos" },
    ...(esAdmin ? [
      { href: "/admin/precios", label: "Precios" },
      { href: "/admin/usuarios", label: "Usuarios" },
    ] : []),
  ];

  return (
    <UploadProvider>
      <div className="min-h-screen bg-zinc-50">
        <header className="bg-[#1a1a2e] text-white shadow-md no-print">
          <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-6">
            <Link href="/" className="text-xl font-black text-[#f5a623] shrink-0">
              IMPRESS
            </Link>
            <nav className="flex items-center gap-1 flex-wrap flex-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-zinc-400 hidden sm:block">
                {perfil?.nombre || user.email}
              </span>
              <form action={logout}>
                <button type="submit"
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-700 hover:bg-zinc-600 transition">
                  Salir
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
      </div>
    </UploadProvider>
  );
}
