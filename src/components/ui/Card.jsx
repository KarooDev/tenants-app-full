import React from "react";

/** Dashboard-style card wrapper with soft glow in the corner */
export default function Card({ className = "", children, as: Tag = "div" }) {
  return (
    <Tag
      className={[
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80",
        "backdrop-blur-sm", // optional but matches dashboard feel
        className,
      ].join(" ")}
    >
      {/* subtle corner glow, same gradient used on Dashboard */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%)",
        }}
      />
      {children}
    </Tag>
  );
}

/** Padded content helper to keep layouts consistent (optional) */
export function CardBody({ className = "", children }) {
  return <div className={["p-4", className].join(" ")}>{children}</div>;
}
