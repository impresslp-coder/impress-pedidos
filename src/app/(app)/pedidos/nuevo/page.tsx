import Link from "next/link";

export default function NuevoPedidoChoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">¿Qué tipo de pedido es?</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Elegí si es un pedido estándar o un encargo a un proveedor externo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">

        {/* Pedido normal */}
        <Link
          href="/pedidos/nuevo/pedido"
          className="group flex flex-col gap-3 bg-white rounded-2xl border-2 border-zinc-200 hover:border-[#f5a623] p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: "#1a1a2e" }}
          >
            📋
          </div>
          <div>
            <p className="text-base font-bold text-zinc-800 group-hover:text-[#1a1a2e]">
              Pedido estándar
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              Impresiones, encuadernados, apuntes y otros trabajos propios del local.
            </p>
          </div>
          <span
            className="mt-auto inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg w-fit transition"
            style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
          >
            Nuevo pedido →
          </span>
        </Link>

        {/* Encargo terciarizado */}
        <Link
          href="/terciarizados/nuevo"
          className="group flex flex-col gap-3 bg-white rounded-2xl border-2 border-zinc-200 hover:border-[#f5a623] p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: "#1a1a2e" }}
          >
            🏭
          </div>
          <div>
            <p className="text-base font-bold text-zinc-800 group-hover:text-[#1a1a2e]">
              Encargo terciarizado
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              Stickers, lonas, tarjetas u otros trabajos que realizan proveedores externos.
            </p>
          </div>
          <span
            className="mt-auto inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg w-fit transition"
            style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
          >
            Nuevo encargo →
          </span>
        </Link>

      </div>
    </div>
  );
}
