import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Realtime Dashboards</h1>
        <p className="text-xl text-slate-400">
          Multi-tenant collaborative analytics. Sub-100ms WebSocket sync.
          Per-tenant data isolation enforced at the database layer.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 border border-slate-700 hover:bg-slate-900 rounded-lg font-medium transition"
          >
            Create workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
