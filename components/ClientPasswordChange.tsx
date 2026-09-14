import React, { useState } from "react";
import { User } from "firebase/auth";
import { LockKeyhole } from "lucide-react";

export default function ClientPasswordChange({ user }: { user: User }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "No fue posible guardar la clave.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-4">
      <form
        onSubmit={submit}
        className="max-w-md w-full bg-slate-900 border border-blue-500/30 rounded-2xl p-7 space-y-4"
      >
        <LockKeyhole className="text-blue-400" size={36} />
        <h1 className="text-2xl font-bold">Protege tu cuenta</h1>
        <p className="text-slate-400 text-sm">
          Cambia la contraseña temporal antes de entrar. Usa al menos 10
          caracteres, letras y números.
        </p>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3"
          placeholder="Nueva contraseña"
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-blue-600 rounded-xl p-3 font-bold disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar y continuar"}
        </button>
      </form>
    </main>
  );
}
