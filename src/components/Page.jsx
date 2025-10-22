export default function Page({ title, children, actions }) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          {actions}
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">{children}</div>
      </div>
    );
  }
  