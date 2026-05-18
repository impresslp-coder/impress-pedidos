import { Suspense } from "react";
import Image from "next/image";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center brand-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/impress-logo.png" alt="IMPRESS" width={260} height={180} className="mx-auto h-32 w-auto object-contain" priority />
          <p className="text-zinc-300 text-sm mt-2 font-bold">Gestion de pedidos</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-8 border-t-4 border-[#fff200]">
          <h2 className="text-lg font-black text-zinc-900 mb-6">Iniciar sesion</h2>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
