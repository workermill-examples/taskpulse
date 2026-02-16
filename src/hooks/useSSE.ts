"use client";

import { useEffect, useRef, useState } from "react";

interface UseSSEOptions {
  /** Auto-reconnect on connection loss */
  autoReconnect?: boolean;
  /** Reconnect delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum number of reconnect attempts */
  maxReconnectAttempts?: number;
  /** EventSource configuration options */
  eventSourceOptions?: EventSourceInit;
}

interface UseSSEReturn {
  /** Last received message */
  lastMessage: MessageEvent | null;
  /** Connection state */
  connectionState: "connecting" | "open" | "closed" | "error";
  /** Number of reconnect attempts made */
  reconnectCount: number;
  /** Manually close the connection */
  close: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

export default function useSSE(
  url: string | null,
  options: UseSSEOptions = {}
): UseSSEReturn {
  const {
    autoReconnect = true,
    reconnectDelay = 1000,
    maxReconnectAttempts = 5,
    eventSourceOptions = {},
  } = options;

  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "open" | "closed" | "error"
  >("closed");
  const [reconnectCount, setReconnectCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const close = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnectionState("closed");
  };

  const connect = () => {
    if (!url || !mountedRef.current) return;

    close(); // Close existing connection
    setConnectionState("connecting");

    try {
      const eventSource = new EventSource(url, eventSourceOptions);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionState("open");
        setReconnectCount(0); // Reset reconnect count on successful connection
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;
        setLastMessage(event);
      };

      eventSource.onerror = () => {
        if (!mountedRef.current) return;
        setConnectionState("error");

        // Auto-reconnect logic
        if (autoReconnect && reconnectCount < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setReconnectCount((prev) => prev + 1);
            connect();
          }, reconnectDelay * Math.pow(2, reconnectCount)); // Exponential backoff
        }
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      setConnectionState("error");
    }
  };

  const reconnect = () => {
    setReconnectCount(0);
    connect();
  };

  useEffect(() => {
    mountedRef.current = true;
    if (url) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      close();
    };
  }, [url]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    lastMessage,
    connectionState,
    reconnectCount,
    close,
    reconnect,
  };
}