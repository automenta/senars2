import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type ConnectionStatusType = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

type WebSocketHookOptions = {
  onMessage: (message: any) => void;
};

export const useWebSocket = (url: string, { onMessage }: WebSocketHookOptions) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const clientId = useRef<string>(uuidv4());

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const messageWithClient = { ...message, clientId: clientId.current };
      ws.current.send(JSON.stringify(messageWithClient));
    } else {
      console.error('Cannot send message, WebSocket is not connected.');
    }
  }, []);

  useEffect(() => {
    const connect = () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.debug("WebSocket is already connected.");
        return;
      }

      setConnectionStatus('connecting');
      const websocket = new WebSocket(url);
      ws.current = websocket;

      websocket.onopen = () => {
        console.info('WebSocket connected');
        setConnectionStatus('connected');
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
        }
        // Initial message to get all goals on connect
        const requestId = uuidv4();
        sendMessage({ request_type: 'GET_ALL_GOALS', requestId: requestId });
      };

      websocket.onmessage = (event) => {
        console.debug('WebSocket message received:', event.data);
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

      websocket.onclose = () => {
        console.info('WebSocket disconnected');
        if (reconnectTimer.current) {
          return;
        }
        setConnectionStatus('reconnecting');
        reconnectTimer.current = setTimeout(() => {
          console.info('Attempting to reconnect...');
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url, onMessage, sendMessage]);

  return { connectionStatus, sendMessage };
};
