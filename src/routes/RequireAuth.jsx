// src/routes/RequireAuth.jsx
import { Fragment } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

/* Tiny top progress bar (scoped here so no extra imports needed) */
function TopBarProgress({ show = false, label = "Restoring your session" }) {
  return (
    <div aria-hidden={!show}>
      <div
        className={`fixed top-0 left-0 right-0 z-50 h-[2px] overflow-hidden transition-opacity
          ${show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="absolute inset-y-0 left-0 w-1/3 bg-[var(--accent)]/80 animate-[barMove_1.2s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes barMove {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(60%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
}

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // While Firebase resolves, keep UI clean: show only a slim top bar + SR text
  if (loading) {
    return (
      <Fragment>
        <TopBarProgress show label="Restoring your session" />
        <span className="sr-only" aria-live="polite">Restoring your session</span>
      </Fragment>
    );
  }

  // If unauthenticated, send to Sign In and preserve where they came from
  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: loc }} />;
  }

  // Authenticated → allow route to render
  return children;
}
