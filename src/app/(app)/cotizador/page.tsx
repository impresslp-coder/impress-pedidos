import { redirect } from "next/navigation";

export default function CotizadorPage() {
  redirect("/ventas?modo=cotizar");
}
