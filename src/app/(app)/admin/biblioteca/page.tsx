import { redirect } from "next/navigation";
import { isBibliotecaAdmin } from "@/lib/biblioteca-admin";
import BibliotecaManager from "./biblioteca-manager";

export const dynamic = "force-dynamic";

export default async function AdminBibliotecaPage() {
  if (!await isBibliotecaAdmin()) redirect("/");
  return <BibliotecaManager />;
}
