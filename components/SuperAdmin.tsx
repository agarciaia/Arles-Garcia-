import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type Workshop = {
  id: string;
  businessName: string;
  username: string;
  status: string;
  plan: string;
  expiresAt: string | null;
  lastAccessAt: string | null;
};
const request = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || "No fue posible completar la operación.");
  return data;
};

export default function SuperAdmin() {
  const [session, setSession] = useState<
    "loading" | "login" | "change" | "ready"
  >("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    username: "",
    password: "",
    trialDays: 15,
  });
  const load = async () => {
    const data = await request("/api/admin/workshops");
    setWorkshops(data.workshops);
  };
  useEffect(() => {
    request("/api/admin/session")
      .then((x) => setSession(x.mustChangePassword ? "change" : "ready"))
      .catch(() => setSession("login"));
  }, []);
  useEffect(() => {
    if (session === "ready") load().catch((e) => setError(e.message));
  }, [session]);
  const filtered = useMemo(
    () =>
      workshops.filter((x) =>
        `${x.businessName} ${x.username} ${x.status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [workshops, query],
  );
  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const x = await request("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setSession(x.mustChangePassword ? "change" : "ready");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setSession("ready");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/workshops", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ businessName: "", username: "", password: "", trialDays: 15 });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (id: string, value: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/workshops", {
        method: "PATCH",
        body: JSON.stringify({ id, ...value }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (session === "loading")
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">
        Verificando acceso…
      </div>
    );
  if (session === "login" || session === "change")
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-4">
        <form
          onSubmit={session === "login" ? submitLogin : changePassword}
          className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-7 space-y-4"
        >
          <ShieldCheck className="text-blue-400" size={36} />
          <h1 className="text-2xl font-bold">
            {session === "login"
              ? "Superadministración"
              : "Crea una clave definitiva"}
          </h1>
          <p className="text-sm text-slate-400">
            {session === "login"
              ? "Acceso exclusivo de administración comercial."
              : "El acceso inicial solo puede usarse una vez. Usa 12 o más caracteres, letras y números."}
          </p>
          {session === "login" && (
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3"
            type="password"
            placeholder={session === "login" ? "Clave" : "Nueva clave segura"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-blue-600 rounded-xl p-3 font-bold disabled:opacity-50"
          >
            {busy
              ? "Procesando…"
              : session === "login"
                ? "Ingresar"
                : "Guardar nueva clave"}
          </button>
        </form>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-blue-400 text-sm font-bold">GESTIÓN TALLER</p>
            <h1 className="text-3xl font-bold">Panel comercial</h1>
          </div>
          <button
            onClick={async () => {
              await request("/api/admin/session", { method: "DELETE" });
              setSession("login");
            }}
            className="p-3 bg-slate-900 rounded-xl"
          >
            <LogOut />
          </button>
        </header>
        {error && (
          <div className="border border-red-500/40 bg-red-500/10 text-red-200 p-3 rounded-xl">
            {error}
          </div>
        )}
        <form
          onSubmit={create}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 grid md:grid-cols-5 gap-3"
        >
          <input
            className="bg-slate-950 border border-slate-700 rounded-xl p-3"
            placeholder="Nombre del taller"
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            required
          />
          <input
            className="bg-slate-950 border border-slate-700 rounded-xl p-3"
            placeholder="Usuario"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            className="bg-slate-950 border border-slate-700 rounded-xl p-3"
            type="password"
            placeholder="Contraseña temporal"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className="bg-slate-950 border border-slate-700 rounded-xl p-3"
            value={form.trialDays}
            onChange={(e) =>
              setForm({ ...form, trialDays: Number(e.target.value) })
            }
          >
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
          </select>
          <button
            disabled={busy}
            className="bg-blue-600 rounded-xl p-3 font-bold flex justify-center gap-2"
          >
            <Plus />
            Crear taller
          </button>
        </form>
        <div className="relative">
          <Search
            className="absolute left-4 top-3.5 text-slate-500"
            size={19}
          />
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4"
            placeholder="Buscar taller, usuario o estado"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="grid gap-3">
          {filtered.map((w) => (
            <article
              key={w.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center gap-4"
            >
              <Building2 className="text-blue-400" />
              <div className="flex-1">
                <h2 className="font-bold">{w.businessName}</h2>
                <p className="text-sm text-slate-400">
                  @{w.username} · {w.plan} · {w.status}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Vence:{" "}
                  {w.expiresAt
                    ? new Date(w.expiresAt).toLocaleDateString("es-CL")
                    : "—"}{" "}
                  · Último acceso:{" "}
                  {w.lastAccessAt
                    ? new Date(w.lastAccessAt).toLocaleString("es-CL")
                    : "Nunca"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    update(w.id, {
                      status: "active",
                      expiresAt: new Date(
                        Date.now() + 30 * 86400000,
                      ).toISOString(),
                    })
                  }
                  className="px-3 py-2 bg-emerald-600 rounded-lg text-sm"
                >
                  Activar 30 días
                </button>
                <button
                  onClick={() => {
                    const date = prompt("Nueva fecha de vencimiento (AAAA-MM-DD)");
                    if (date)
                      update(w.id, {
                        expiresAt: `${date}T23:59:59.000Z`,
                        plan: w.plan,
                      });
                  }}
                  className="px-3 py-2 bg-blue-700 rounded-lg text-sm"
                >
                  Cambiar fecha
                </button>
                <button
                  onClick={() => update(w.id, { status: "past_due" })}
                  className="px-3 py-2 bg-amber-600 rounded-lg text-sm"
                >
                  Solo lectura
                </button>
                <button
                  onClick={() => update(w.id, { status: "suspended" })}
                  className="px-3 py-2 bg-red-700 rounded-lg text-sm"
                >
                  Suspender
                </button>
                <button
                  onClick={() => {
                    const p = prompt(
                      "Nueva contraseña temporal (mínimo 8 caracteres)",
                    );
                    if (p) update(w.id, { password: p });
                  }}
                  className="px-3 py-2 bg-slate-700 rounded-lg text-sm flex gap-1"
                >
                  <RefreshCw size={16} />
                  Credenciales
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
