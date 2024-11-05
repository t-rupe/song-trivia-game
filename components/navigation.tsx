"use client";

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { initSocket, getSocket } from '../lib/socket';

export function NavigationEvents() {
  const pathname = usePathname();

  const ensureSocketConnection = useCallback(() => {
    let socket = getSocket();
    if (!socket) {
      socket = initSocket();
    }
    
    // If socket exists but is disconnected, reconnect it
    if (socket && !socket.connected) {
      socket.connect();
    }

    return socket;
  }, []);

  // Initial socket setup
  useEffect(() => {
    const socket = ensureSocketConnection();

    const handleDisconnect = () => {
      console.log('Socket disconnected - attempting reconnect...');
      ensureSocketConnection();
    };

    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('disconnect', handleDisconnect);
    };
  }, [ensureSocketConnection]);

  // Handle navigation changes
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) {
      ensureSocketConnection();
    }

    // Handle room-specific logic
    if (pathname.startsWith('/room/')) {
      const roomCode = pathname.split('/').pop();
      if (roomCode) {
        // Handle room joining logic if needed
      }
    }
  }, [pathname, ensureSocketConnection]);

  return null;
}