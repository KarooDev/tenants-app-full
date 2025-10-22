import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";


export default function ManagerSwapModal({
  open,
  onClose,
  idToken,
  building,           // { ID, name, management_user_id }
  onTransferred,      // (count) => void
}) {
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState([]);
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState("");

  // fetch BUILDING_MGMT list for dropdown
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setError("");
      try {
        const res = await api.users.list({ idToken, role: "BUILDING_MGMT" });
        if (!mounted) return;
        if (!res?.ok) {
          setError(res?.error || "failed_to_load_users");
        } else {
          setManagers(res.items || []);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      }
    })();
    return () => { mounted = false; };
  }, [open, idToken]);

  // exclude current manager from target list
  const options = useMemo(() => {
    return (managers || []).filter(u => String(u.ID) !== String(building?.management_user_id));
  }, [managers, building]);

  const handleTransfer = async () => {
    if (!toUserId) { setError("choose_target_manager"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.admin.reassignManager({
        idToken,
        from_user_id: building.management_user_id,
        to_user_id: toUserId,
        building_ids: [building.ID],
      });
      if (!res?.ok) {
        setError(res?.error || "transfer_failed");
      } else {
        onTransferred?.(res.transferred || 0);
        onClose?.();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none">
      {/* scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      {/* toast card */}
      <div className="relative pointer-events-auto w-[92vw] md:w-[520px] card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0">
        <h2 className="text-base font-semibold">Reassign building manager</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Building: <span className="font-medium">{building?.name}</span>
        </p>
  
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium">New manager</label>
          <select
            className="ui-select w-full"
            value={toUserId}
            onChange={e => setToUserId(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a manager…</option>
            {options.map(u => (
              <option key={u.ID} value={u.ID}>
                {u.full_name || u.username || u.email} ({u.ID})
              </option>
            ))}
          </select>
          {error ? <div className="mt-2 text-sm text-red-400">{error}</div> : null}
        </div>
  
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button
            onClick={() => onClose?.()}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            className="rounded-lg px-3 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-600)] disabled:opacity-60"
            disabled={loading || !toUserId}
          >
            {loading ? "Transferring…" : "Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
  
}
