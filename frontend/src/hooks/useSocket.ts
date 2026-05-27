import { useEffect, useRef, useState, useCallback } from "react";

export function useSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/novel`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    socket.onclose = () => {
      setConnected(false);
      socketRef.current = null;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    socketRef.current = socket;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((event: string, data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event, ...data }));
    }
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    const listener = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === event || event === "message") {
          handler(data);
        }
      } catch {}
    };

    socket.addEventListener("message", listener);
    return () => socket.removeEventListener("message", listener);
  }, []);

  return { socket: socketRef, connected, send, on };
}
