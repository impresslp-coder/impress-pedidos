import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { UploadProvider } from "./upload-context";
import { CajaMenu } from "./caja-menu";

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
    { href: "/estadisticas", label: "Estadisticas" },
    ...(esAdmin ? [
      { href: "/admin/precios", label: "Precios" },
      { href: "/admin/proveedores", label: "Proveedores" },
      { href: "/admin/usuarios", label: "Usuarios" },
    ] : []),
  ];

  return (
    <UploadProvider>
      <div className="min-h-screen bg-zinc-50">
        <header className="brand-surface text-white shadow-md no-print border-b-4 border-[#fff200]">
          <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <Image src="/impress-logo.png" alt="IMPRESS" width={118} height={70} className="h-12 w-auto object-contain" priority />
              <span className="sr-only">IMPRESS</span>
            </Link>
            <nav className="flex items-center gap-1 flex-wrap flex-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className="px-3 py-1.5 rounded-md text-sm font-black text-zinc-200 hover:text-white hover:bg-white/10 transition">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 shrink-0">
              <CajaMenu userName={perfil?.nombre || user.email || "Usuario"} />
              <form action={logout}>
                <button type="submit"
                  className="px-3 py-1.5 rounded-md text-xs font-black bg-[#e6007e] text-white hover:bg-[#c8006f] transition">
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
