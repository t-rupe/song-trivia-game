"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  const apiUrl = process.env.NODE_ENV === 'production' 
    ? process.env.NEXT_PUBLIC_API_URL_PROD 
    : process.env.NEXT_PUBLIC_API_URL_DEV;

  if (!socket) {
    socket = io(apiUrl, {
      transports: ["websocket"],
      autoConnect: false,
      forceNew: true, // Force new connection each time
    });
  }
  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
