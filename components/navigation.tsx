"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initSocket } from '../lib/socket';

export function NavigationEvents() {
  const pathname = usePathname();

  useEffect(() => {
    const socket = initSocket();
    
    // Ensure socket is connected when needed
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      // Only disconnect if we're not on a room page
      if (!pathname.startsWith('/room/')) {
        socket.disconnect();
      }
    };
  }, [pathname]);

  return null;
}
