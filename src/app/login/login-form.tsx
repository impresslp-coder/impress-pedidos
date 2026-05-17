"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      suppressHydrationWarning
      className="w-full rounded-md bg-[#1a1a2e] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16213e] disabled:opacity-60"
    >
      {pending ? "Ingresando..." : "Ingresar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-48" />;
  }

  return (
    <form action={formAction} className="space-y-4" suppressHydrationWarning>
      <input type="hidden" name="redirect" value={redirectTo} />

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          suppressHydrationWarning
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#f5a623] focus:outline-none focus:ring-1 focus:ring-[#f5a623]"
          placeholder="usuario@impress.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          suppressHydrationWarning
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#f5a623] focus:outline-none focus:ring-1 focus:ring-[#f5a623]"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
