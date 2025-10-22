// src/components/AppShell.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileDrawer from "./MobileDrawer";

/* tiny menu icon */
function IconMenu({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" className={className}>
      <path d="M4 6h16M4 12h16M4 18h16"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="grid md:grid-cols-[240px_1fr] min-h-dvh overflow-hidden">
        {/* Sidebar (desktop only) */}
        <aside className="hidden md:block sticky top-0 h-dvh border-r border-[var(--border)] overflow-y-auto">
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>

        {/* Content column */}
        <div className="flex flex-col h-dvh min-h-0">
          {/* MOBILE TOP BAR ONLY */}
          <header className="md:hidden sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/70 backdrop-blur">
            <div className="px-3 h-14 flex items-center justify-between">
              <button
                className="p-2 -ml-1 rounded-lg hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <IconMenu />
              </button>

              {/* Centered brand (replace with your logo as needed) */}
              <NavLink to="/" className="inline-flex items-center" onClick={() => setOpen(false)}>
                <img
                  src={`${import.meta.env.BASE_URL}bineytna.svg`}
                  alt="Bineytna"
                  className="block h-6 w-auto select-none"
                  draggable="false"
                  decoding="async"
                />
              </NavLink>

              {/* Spacer to keep the logo centered */}
              <span className="w-[38px]" aria-hidden />
            </div>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 lg:px-8 py-4 md:py-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
