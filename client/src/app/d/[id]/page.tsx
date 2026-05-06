"use client";

import { useState, useEffect } from "react";
import { useDashboardSocket } from "@/hooks/useDashboardSocket";

interface Cursor {
  userId: string;
  x: number;
  y: number;
}

interface Props {
  params: { id: string };
}

export default function DashboardPage({ params }: Props) {
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    setToken(localStorage.getItem("token") ?? "");
  }, []);

  const { state, send } = useDashboardSocket({
    dashboardId: params.id,
    token,
    onMessage: (msg) => {
      if (msg.type === "cursor_move") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(msg.userId as string, {
            userId: msg.userId as string,
            x: msg.x as number,
            y: msg.y as number,
          });
          return next;
        });
      }
    },
  });

  if (!token) {
    return <div className="p-8">Please sign in.</div>;
  }

  return (
    <main
      className="min-h-screen p-8 relative"
      onMouseMove={(e) => {
        send({
          type: "cursor_move",
          dashboardId: params.id,
          x: e.clientX,
          y: e.clientY,
        });
      }}
    >
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard {params.id.slice(0, 8)}</h1>
        <span
          className={`px-3 py-1 text-xs rounded-full ${
            state === "open" ? "bg-green-600" : "bg-amber-600"
          }`}
        >
          {state}
        </span>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* widgets render here */}
        <div className="col-span-6 h-64 bg-slate-900 rounded-lg p-4">
          Widget placeholder
        </div>
        <div className="col-span-6 h-64 bg-slate-900 rounded-lg p-4">
          Widget placeholder
        </div>
      </div>

      {/* Live cursors of other users */}
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none transition-transform duration-75"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <div className="w-3 h-3 bg-pink-500 rounded-full" />
          <span className="text-xs text-pink-400 ml-2">{cursor.userId.slice(0, 6)}</span>
        </div>
      ))}
    </main>
  );
}
