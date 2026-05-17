"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { crearTerciarizado } from "./actions";

type Encargo = { id: string; nombre: string; precio: number | null };
type Cliente = { id: string; nombre: string; telefono: string | null; cod_pais: string | null };

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="px-6 py-2 rounded-lg bg-amber-btn text-navy font-semibold text-sm hover:opacity-90 disabled:opacity-60 transition"
      style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
    >
      {pending ? "Guardando..." : "Guardar encargo"}
    </button>
  );
}

export default function TerciarizadoForm({
  catalogo,
  clientes: clientesIniciales,
}: {
  catalogo: Encargo[];
  clientes: Cliente[];
}) {
  const [state, formAction] = useActionState(crearTerciarizado, undefined);

  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales);
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTel, setNuevoTel] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string>();

  const [itemQuery, setItemQuery] = useState("");
  const [precioSugerido, setPrecioSugerido] = useState("");

  const clientesFiltrados = clienteQuery
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.toLowerCase()))
    : clientes.slice(0, 15);

  const encargosFiltr = itemQuery
    ? catalogo.filter((e) => e.nombre.toLowerCase().includes(itemQuery.toLowerCase()))
    : catalogo;

  const clienteSel = clientes.find((c) => c.id === clienteId);
  const telefonoCliente = clienteSel
    ? `${clienteSel.cod_pais ? "+" + clienteSel.cod_pais : ""}${clienteSel.telefono ?? ""}`.trim()
    : "";

  const crearClienteNuevo = async () => {
    if (!nuevoNombre.trim()) return;
    setCreandoCliente(true);
    setErrorCliente(undefined);
    const fd = new FormData();
    fd.set("nombre", nuevoNombre);
    fd.set("telefono", nuevoTel);
    fd.set("cod_pais", "54");
    fd.set("mail", "");
    const res = await fetch("/api/clientes/crear", { method: "POST", body: fd });
    const json = await res.json();
    if (json.error) { setErrorCliente(json.error); setCreandoCliente(false); return; }
    if (json.cliente) {
      setClientes((prev) => [...prev, json.cliente]);
      setClienteId(json.cliente.id);
      setClienteNombre(json.cliente.nombre);
      setClienteQuery(json.cliente.nombre);
    }
    setNuevoNombre("");
    setNuevoTel("");
    setMostrarNuevoCliente(false);
    setCreandoCliente(false);
  };

  const inputCls = "w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition";
  const inputSmCls = "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white";

  return (
    <form action={formAction} className="max-w-xl bg-white rounded-xl border border-zinc-200 shadow-sm p-6 space-y-4">

      <input type="hidden" name="cliente" value={clienteNombre} />
      <input type="hidden" name="telefono" value={telefonoCliente} />

      {/* Cliente */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700">
          Cliente <span className="text-red-500">*</span>
        </label>

        <div className="relative">
          <input
            value={clienteQuery}
            onChange={(e) => {
              setClienteQuery(e.target.value);
              setClienteId("");
              setClienteNombre("");
            }}
            suppressHydrationWarning
            className={inputCls}
            placeholder="Buscar cliente..."
          />
          {clienteQuery && !clienteId && clientesFiltrados.length > 0 && (
            <ul className="absolute z-20 w-full border border-zinc-200 rounded-xl mt-1 max-h-44 overflow-y-auto shadow-xl bg-white">
              {clientesFiltrados.map((c) => (
                <li
                  key={c.id}
                  className="px-3 py-2.5 text-sm hover:bg-amber-50 cursor-pointer border-b border-zinc-50 last:border-0"
                  onClick={() => {
                    setClienteId(c.id);
                    setClienteNombre(c.nombre);
                    setClienteQuery(c.nombre);
                  }}
                >
                  <p className="font-semibold text-zinc-800">{c.nombre}</p>
                  {c.telefono && <p className="text-zinc-400 text-xs">{c.telefono}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {clienteId ? (
          <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            Seleccionado
            {telefonoCliente && (
              <span className="text-zinc-400 font-normal ml-2">{telefonoCliente}</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-zinc-400">Escribi para buscar</p>
        )}

        {!mostrarNuevoCliente ? (
          <button
            type="button"
            onClick={() => setMostrarNuevoCliente(true)}
            className="w-full text-xs border-2 border-dashed border-amber-200 rounded-xl py-2 font-semibold hover:bg-amber-50 transition"
            style={{ color: "#f5a623" }}
          >
            + Nuevo cliente
          </button>
        ) : (
          <div className="space-y-2 border-2 border-amber-100 rounded-xl p-3 bg-amber-50">
            <p className="text-xs font-bold text-amber-800">Nuevo cliente</p>
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre *"
              suppressHydrationWarning
              className={inputSmCls}
            />
            <input
              value={nuevoTel}
              onChange={(e) => setNuevoTel(e.target.value)}
              placeholder="Telefono"
              suppressHydrationWarning
              className={inputSmCls}
            />
            {errorCliente && <p className="text-xs text-red-600 font-medium">{errorCliente}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={crearClienteNuevo}
                disabled={!nuevoNombre || creandoCliente}
                className="flex-1 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-50 transition"
                style={{ backgroundColor: "#1a1a2e" }}
              >
                {creandoCliente ? "..." : "Crear"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarNuevoCliente(false);
                  setNuevoNombre("");
                  setNuevoTel("");
                  setErrorCliente(undefined);
                }}
                className="px-3 py-1.5 rounded-lg bg-white text-zinc-500 text-xs border border-zinc-200 hover:bg-zinc-100 transition"
              >
                X
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Item / producto */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Item / producto <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            name="item"
            value={itemQuery}
            onChange={(e) => {
              setItemQuery(e.target.value);
              const match = catalogo.find((c) => c.nombre === e.target.value);
              if (match?.precio) setPrecioSugerido(String(match.precio));
            }}
            suppressHydrationWarning
            className={inputCls}
            placeholder="Buscar en catalogo o escribir libremente"
            required
          />
          {itemQuery && encargosFiltr.length > 0 && (
            <ul className="absolute z-20 w-full border border-zinc-200 rounded-xl mt-1 max-h-44 overflow-y-auto shadow-xl bg-white">
              {encargosFiltr.map((e) => (
                <li
                  key={e.id}
                  className="px-3 py-2.5 text-sm hover:bg-amber-50 cursor-pointer border-b border-zinc-50 last:border-0"
                  onClick={() => {
                    setItemQuery(e.nombre);
                    if (e.precio) setPrecioSugerido(String(e.precio));
                  }}
                >
                  <span className="font-semibold text-zinc-800">{e.nombre}</span>
                  {e.precio != null && (
                    <span className="text-zinc-400 text-xs ml-2">${e.precio}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Anotacion */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Anotacion</label>
        <input
          name="anotacion"
          suppressHydrationWarning
          className={inputCls}
          placeholder="Detalles adicionales"
        />
      </div>

      {/* Total y Sena */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Total ($)</label>
          <input
            name="total"
            type="number"
            value={precioSugerido}
            onChange={(e) => setPrecioSugerido(e.target.value)}
            suppressHydrationWarning
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Sena ($)</label>
          <input
            name="senia"
            type="number"
            suppressHydrationWarning
            className={inputCls}
            defaultValue="0"
          />
        </div>
      </div>

      {/* Sucursal */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Sucursal</label>
        <input
          name="sucursal"
          suppressHydrationWarning
          className={inputCls}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <SubmitButton disabled={!clienteId} />
    </form>
  );
}
