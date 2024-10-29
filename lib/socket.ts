"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io("http://localhost:3001", {
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
