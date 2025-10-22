// src/routes/RequireRole.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

/**
 * Usage:
 *  <RequireRole role="BUILDING_MGMT">{children}</RequireRole>
 *  <RequireRole role={["STAFF","BUILDING_MGMT"]}>{children}</RequireRole>
 *  <RequireRole role="TENANT" fallback="/">{children}</RequireRole>
 *
 * Props:
 *  - role: string | string[]  (required)
 *  - fallback: string (default "/")
 *  - allowAdmin: boolean (default true) — ADMIN bypass
 */
export default function RequireRole({
  role,
  children,
  fallback = "/",
  allowAdmin = true,
}) {
  const { user } = useAuth();
  if (!user) return null; // parent RequireAuth should wrap this route

  const want = Array.isArray(role) ? role : [role];
  const uRole = String(user.role || "").toUpperCase();

  const ok =
    (allowAdmin && uRole === "ADMIN") ||
    want.map((r) => String(r || "").toUpperCase()).includes(uRole);

  if (!ok) return <Navigate to={fallback} replace />;

  return <>{children}</>;
}
