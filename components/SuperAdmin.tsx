import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Copy,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type Workshop = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  status: string;
  plan: string;
  expiresAt: string | null;
  lastAccessAt: string | null;
};

type CreatedAccess = {
  businessName: string;
  email: string;
  password: string;
  phone: string;
};

const emptyForm = {
  businessName: "",
  ownerName: "",
  email: "",
  phone: "",
  password: "",
  plan: "trial",
  trialDays: 15,
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
  if (!response.ok) throw new Error(data.message || "No fue posible completar la operación.");
  return data;
};

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => chars[value % chars.length]).join("");
};

const accessText = (access: CreatedAccess) =>
  `Acceso Gestión Taller\nTaller: ${access.businessName}\nCorreo: ${access.email}\nContraseña temporal: ${access.password}\n\nAl ingresar por primera vez deberás crear una nueva contraseña.`;

const phoneForWhatsApp = (value: string) => value.replace(/\D/g, "");

export default function SuperAdmin() {
  const [session, setSession] = useState<"loading" | "login" | "change" | "ready">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [createdAccess, setCreatedAccess] = useState<CreatedAccess | null>(null);

  const load = async () => {
    const data = await request("/api/admin/workshops");
    setWorkshops(Array.isArray(data.workshops) ? data.workshops : []);
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
        `${x.businessName} ${x.ownerName} ${x.email} ${x.phone} ${x.status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [workshops, query],
  );

  const counters = useMemo(
    () => ({
      total: workshops.length,
      active: workshops.filter((x) => x.status === "active").length,
      trial: workshops.filter((x) => x.status === "trialing").length,
      readOnly: workshops.filter((x) => x.status === "past_due").length,
      suspended: workshops.filter((x) => x.status === "suspended").length,
    }),
    [workshops],
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
    setNotice("");
    try {
      const temporaryPassword = form.password;
      const data = await request("/api/admin/workshops", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCreatedAccess({
        businessName: data.businessName,
        email: data.email,
        password: temporaryPassword,
        phone: form.phone,
      });
      setForm(emptyForm);
      setNotice("Taller y acceso creados correctamente.");
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
    setNotice("");
    try {
      await request("/api/admin/workshops", {
        method: "PATCH",
        body: JSON.stringify({ id, ...value }),
      });
      setNotice("Cambios guardados.");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCreatedAccess = async () => {
    if (!createdAccess) return;
    await navigator.clipboard.writeText(accessText(createdAccess));
    setNotice("Acceso copiado.");
  };

  if (session === "loading") {
    return <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">Verificando acceso…</div>;
  }

  if (session === "login" || session === "change") {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-4">
        <form
          onSubmit={session === "login" ? submitLogin : changePassword}
          className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-7 space-y-4"
        >
          <ShieldCheck className="text-blue-400" size={36} />
          <h1 className="text-2xl font-bold">
            {session === "login" ? "Superadministración" : "Crea una clave definitiva"}
          </h1>
          <p className="text-sm text-slate-400">
            {session === "login"
              ? "Acceso exclusivo para administrar los talleres y sus cuentas."
              : "El acceso inicial solo puede usarse una vez. Usa 12 o más caracteres, letras y números."}
          </p>
          {session === "login" && (
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3"
              placeholder="Usuario Superadmin"
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
          <button disabled={busy} className="w-full bg-blue-600 rounded-xl p-3 font-bold disabled:opacity-50">
            {busy ? "Procesando…" : session === "login" ? "Ingresar" : "Guardar nueva clave"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-blue-400 text-sm font-bold">GESTIÓN TALLER</p>
            <h1 className="text-3xl font-bold">Superadministrador</h1>
            <p className="text-sm text-slate-400 mt-1">Crea clientes y controla acceso, planes y vencimientos.</p>
          </div>
          <button
            aria-label="Cerrar sesión"
            onClick={async () => {
              await request("/api/admin/session", { method: "DELETE" });
              setSession("login");
            }}
            className="p-3 bg-slate-900 rounded-xl"
          >
            <LogOut />
          </button>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Total", counters.total],
            ["Activos", counters.active],
            ["Prueba", counters.trial],
            ["Solo lectura", counters.readOnly],
            ["Suspendidos", counters.suspended],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </section>

        {error && <div className="border border-red-500/40 bg-red-500/10 text-red-200 p-3 rounded-xl">{error}</div>}
        {notice && <div className="border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 p-3 rounded-xl">{notice}</div>}

        {createdAccess && (
          <section className="bg-blue-500/10 border border-blue-500/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="text-blue-400" size={20} />
              <h2 className="font-bold">Acceso creado — envíalo al cliente</h2>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-slate-400">Taller:</span> {createdAccess.businessName}</p>
              <p><span className="text-slate-400">Correo:</span> {createdAccess.email}</p>
              <p><span className="text-slate-400">Contraseña temporal:</span> <strong>{createdAccess.password}</strong></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyCreatedAccess} className="px-3 py-2 bg-blue-600 rounded-lg text-sm flex gap-2 items-center">
                <Copy size={16} /> Copiar acceso
              </button>
              {createdAccess.phone && (
                <button
                  onClick={() => {
                    const phone = phoneForWhatsApp(createdAccess.phone);
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(accessText(createdAccess))}`, "_blank", "noopener,noreferrer");
                  }}
                  className="px-3 py-2 bg-emerald-600 rounded-lg text-sm"
                >
                  Enviar por WhatsApp
                </button>
              )}
              <button onClick={() => setCreatedAccess(null)} className="px-3 py-2 bg-slate-800 rounded-lg text-sm">Cerrar</button>
            </div>
          </section>
        )}

        <form onSubmit={create} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="text-blue-400" />
            <h2 className="font-bold text-lg">Crear nuevo taller</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input className="bg-slate-950 border border-slate-700 rounded-xl p-3" placeholder="Nombre del taller" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
            <input className="bg-slate-950 border border-slate-700 rounded-xl p-3" placeholder="Nombre del encargado" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            <input className="bg-slate-950 border border-slate-700 rounded-xl p-3" type="email" autoComplete="off" placeholder="Correo del cliente" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="bg-slate-950 border border-slate-700 rounded-xl p-3" type="tel" placeholder="Teléfono / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="flex gap-2">
              <input className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3" type="text" autoComplete="off" placeholder="Contraseña temporal" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="px-3 bg-slate-800 rounded-xl text-xs">Generar</button>
            </div>
            <select className="bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="trial">Prueba</option>
              <option value="founder">Plan Fundador — 30 días</option>
            </select>
            {form.plan === "trial" && (
              <select className="bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}>
                <option value={15}>15 días de prueba</option>
                <option value={30}>30 días de prueba</option>
              </select>
            )}
          </div>
          <button disabled={busy} className="bg-blue-600 rounded-xl px-5 py-3 font-bold flex justify-center gap-2 disabled:opacity-50">
            <Plus size={19} /> Crear taller y acceso
          </button>
        </form>

        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-slate-500" size={19} />
          <input className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4" placeholder="Buscar por taller, correo, encargado, teléfono o estado" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="grid gap-3">
          {filtered.map((w) => (
            <article key={w.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center gap-4">
              <Building2 className="text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="font-bold truncate">{w.businessName}</h2>
                <p className="text-sm text-slate-300 truncate">{w.email || "Sin correo"}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {w.ownerName || "Sin encargado"}{w.phone ? ` · ${w.phone}` : ""} · {w.plan} · {w.status}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Vence: {w.expiresAt ? new Date(w.expiresAt).toLocaleDateString("es-CL") : "—"} · Último acceso: {w.lastAccessAt ? new Date(w.lastAccessAt).toLocaleString("es-CL") : "Nunca"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => update(w.id, { status: "active", expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() })} className="px-3 py-2 bg-emerald-600 rounded-lg text-sm">Renovar 30 días</button>
                <button onClick={() => {
                  const date = prompt("Nueva fecha de vencimiento (AAAA-MM-DD)");
                  if (date) update(w.id, { expiresAt: `${date}T23:59:59.000Z`, plan: w.plan });
                }} className="px-3 py-2 bg-blue-700 rounded-lg text-sm">Cambiar fecha</button>
                <button onClick={() => update(w.id, { status: "past_due" })} className="px-3 py-2 bg-amber-600 rounded-lg text-sm">Solo lectura</button>
                <button onClick={() => update(w.id, { status: "suspended" })} className="px-3 py-2 bg-red-700 rounded-lg text-sm">Suspender</button>
                <button onClick={() => {
                  const p = prompt("Nueva contraseña temporal (mínimo 8 caracteres)", generatePassword());
                  if (p) update(w.id, { password: p });
                }} className="px-3 py-2 bg-slate-700 rounded-lg text-sm flex gap-1 items-center"><RefreshCw size={16} /> Restablecer clave</button>
              </div>
            </article>
          ))}
          {!filtered.length && <div className="text-center text-slate-500 py-8">No hay talleres que coincidan con la búsqueda.</div>}
        </div>
      </div>
    </main>
  );
}
