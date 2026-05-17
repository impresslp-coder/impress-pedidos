import { createClient } from "@/lib/supabase/server";
import PresupuestoForm from "./presupuesto-form";

export default async function NuevoPresupuestoPage() {
  const supabase = await createClient();

  const [{ data: clientes }, { data: productos }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("productos").select("id, nombre, paginas, precio_d, precio_e, precio_f, precio_g").eq("activo", true).order("nombre"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-800 mb-6">Nuevo presupuesto</h1>
      <PresupuestoForm clientes={clientes ?? []} productos={productos ?? []} />
    </div>
  );
}
