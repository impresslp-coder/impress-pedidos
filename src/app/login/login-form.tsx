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
      className="w-full rounded-md bg-black px-3 py-2.5 text-sm font-black text-[#fff200] transition hover:bg-zinc-900 disabled:opacity-60"
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
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#139ce8] focus:outline-none focus:ring-1 focus:ring-[#139ce8]"
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
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#e6007e] focus:outline-none focus:ring-1 focus:ring-[#e6007e]"
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
