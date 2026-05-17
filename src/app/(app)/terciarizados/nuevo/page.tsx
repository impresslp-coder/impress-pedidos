import { createClient } from "@/lib/supabase/server";
import TerciarizadoForm from "./terciarizado-form";

export default async function NuevoTerciarizadoPage() {
  const supabase = await createClient();
  const { data: catalogo } = await supabase
    .from("catalogo_encargos")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, cod_pais")
    .eq("activo", true)
    .order("nombre");

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-800 mb-6">Nuevo encargo terciarizado</h1>
      <TerciarizadoForm catalogo={catalogo ?? []} clientes={clientes ?? []} />
    </div>
  );
}
