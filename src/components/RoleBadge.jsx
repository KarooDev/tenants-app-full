export default function RoleBadge({ role }) {
    const map = {
      ADMIN: "bg-rose-600/20 text-rose-300",
      STAFF: "bg-sky-600/20 text-sky-300",
      BUILDING_MGMT: "bg-amber-600/20 text-amber-300",
      TENANT: "bg-emerald-600/20 text-emerald-300",
      OWNER: "bg-violet-600/20 text-violet-300",
    };
    return <span className={`px-2 py-1 rounded text-xs ${map[role]||"bg-white/10 text-white/70"}`}>{role}</span>;
  }
  