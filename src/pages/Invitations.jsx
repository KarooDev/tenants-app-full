// src/pages/Invitations.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { auth } from "../lib/firebase";
import { api } from "../api";
import { ROLES } from "../constants/roles";

function Row({ inv, onCopy, onCancel, busy }) {
  const link = `${window.location.origin}/sign-up?invite=${encodeURIComponent(inv.invite_code)}`;
  return (
    <div className={`card px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{inv.role} invite</div>
          <span className="px-2 py-[2px] rounded-full text-[11px] border" style={{background:"rgba(255,255,255,.04)", color:"var(--muted)", borderColor:"var(--border)"}}>
            Code: {inv.invite_code}
          </span>
        </div>
        <div className="text-sm text-[var(--muted)] truncate">
          Building: {inv.building_id || "—"} {inv.unit_id ? `• Unit: ${inv.unit_id}` : ""} {inv.email ? `• ${inv.email}` : ""} {inv.username ? `• @${inv.username}` : ""}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Expires: {inv.expires_at || "—"}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
        <button onClick={() => onCopy(link)} className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5">Copy link</button>
        <button onClick={() => onCancel(inv)} className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5 text-red-300">Cancel</button>
      </div>
    </div>
  );
}

function Creator({ buildings, onCreate, busy }) {
  const [role, setRole] = useState("TENANT");
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [expires, setExpires] = useState(14);

  useEffect(() => {
    if (buildings.length && !buildingId) setBuildingId(buildings[0].ID);
  }, [buildings]);

  return (
    <div className={`card p-4 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="text-lg font-semibold mb-2">Create invite</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)]">Role</label>
          <select value={role} onChange={e=>setRole(e.target.value)} className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2">
            <option value="TENANT">Tenant</option>
            <option value="OWNER">Owner</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)]">Building</label>
          <select value={buildingId} onChange={e=>setBuildingId(e.target.value)} className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2">
            {buildings.map(b => <option key={b.ID} value={b.ID}>{b.name} ({b.city})</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)]">Unit ID (optional)</label>
          <input value={unitId} onChange={e=>setUnitId(e.target.value)} placeholder="UNT_xxx (optional)" className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)]">Email (optional)</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@domain.com" className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)]">Username (optional)</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="unique handle" className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)]">Expires in (days)</label>
          <input type="number" min={1} max={90} value={expires} onChange={e=>setExpires(Number(e.target.value||14))} className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2" />
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={() => onCreate({ role, building_id: buildingId, unit_id: unitId.trim(), email: email.trim(), username: username.trim(), expires_in_days: expires })}
          className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white"
        >
          Create invite
        </button>
      </div>
    </div>
  );
}

export default function Invitations() {
  const { user } = useAuth();
  const canManage = [ROLES.ADMIN, ROLES.BUILDING_MGMT, ROLES.STAFF].includes(String(user?.role).toUpperCase());

  const [buildings, setBuildings] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function loadAll() {
    try {
      setLoading(true); setError("");
      const idToken = await auth.currentUser?.getIdToken();
      const [bRes, iRes] = await Promise.all([
        api.buildings.list({ idToken }),
        api.invitations.list({ idToken }),
      ]);
      if (!bRes?.ok) throw new Error(bRes?.error || "buildings_failed");
      if (!iRes?.ok) throw new Error(iRes?.error || "invites_failed");
      setBuildings(bRes.items || []);
      setItems(iRes.items || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ loadAll(); }, []);

  async function createInvite(payload) {
    try {
      setBusy("create");
      const idToken = await auth.currentUser?.getIdToken();
      const res = await api.invitations.create({ idToken, ...payload });
      if (!res?.ok) throw new Error(res?.error || "create_failed");
      // Prepend to list (will show until used/cancelled)
      setItems(prev => [res.invite, ...prev]);
      // Quick copy for convenience
      const link = `${window.location.origin}/sign-up?invite=${encodeURIComponent(res.invite.invite_code)}`;
      await navigator.clipboard.writeText(link);
      alert("Invite created and link copied to clipboard!");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function cancelInvite(inv) {
    if (!confirm(`Cancel invite ${inv.invite_code}?`)) return;
    try {
      setBusy(inv.invite_code);
      const idToken = await auth.currentUser?.getIdToken();
      const res = await api.invitations.cancel({ idToken, invite_code: inv.invite_code });
      if (!res?.ok) throw new Error(res?.error || "cancel_failed");
      setItems(prev => prev.filter(x => x.invite_code !== inv.invite_code));
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link);
    alert("Copied invite link!");
  }

  if (!canManage) {
    return (
      <div className="card p-6">
        <div className="text-lg font-semibold mb-1">Invitations</div>
        <div className="text-[var(--muted)]">You don’t have permission to view this page.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <div className="text-sm text-[var(--muted)]">Admin</div>
        <h1 className="text-2xl font-semibold">Invitations</h1>
      </div>

      {/* creator */}
      <Creator buildings={buildings} onCreate={createInvite} busy={!!busy && busy==="create"} />

      {/* list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Open invites</div>
          <button onClick={loadAll} className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5">Refresh</button>
        </div>

        {loading ? (
          <div className="card p-4 text-[var(--muted)]">Loading…</div>
        ) : error ? (
          <div className="card p-4 text-red-300 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="card p-4 text-[var(--muted)]">No open invites.</div>
        ) : (
          <div className="grid gap-3">
            {items.map(inv => (
              <Row key={inv.invite_code} inv={inv} busy={busy===inv.invite_code} onCopy={copyLink} onCancel={cancelInvite} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
