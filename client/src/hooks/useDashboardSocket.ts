/**
 * useDashboardSocket — connects to the dashboard WS endpoint and subscribes
 * to a specific dashboard's event stream.
 *
 * Handles:
 *   - automatic reconnection with exponential backoff
 *   - dispatching incoming messages to typed handlers
 *   - cleanup on unmount or dashboard change
 */
import { useEffect, useRef, useState, useCallback } from "react";

type ConnectionState = "connecting" | "open" | "closed" | "error";

interface IncomingMessage {
  type: string;
  [key: string]: unknown;
}

interface UseDashboardSocketOpts {
  dashboardId: string;
  token: string;
  url?: string;
  onMessage?: (msg: IncomingMessage) => void;
}

export function useDashboardSocket({
  dashboardId,
  token,
  url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws",
  onMessage,
}: UseDashboardSocketOpts) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | undefined;

    function connect() {
      if (cancelled) return;
      setState("connecting");
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        setState("open");
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({ type: "subscribe", dashboardId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as IncomingMessage;
          onMessageRef.current?.(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => setState("error");

      ws.onclose = () => {
        setState("closed");
        if (cancelled) return;
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
        reconnectAttempts.current += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [dashboardId, token, url]);

  return { state, send };
}
