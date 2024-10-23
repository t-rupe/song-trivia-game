"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { initSocket } from "../../lib/socket";

export default function RoomPage() {
  const params = useParams();
  const roomcode = params?.roomcode as string;
  const [socketId, setSocketId] = useState<string | null>(null);
  const [numUsers, setNumUsers] = useState<number | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!roomcode) return;

    const socket = initSocket();

    socket.emit("joinRoom", roomcode);

    socket.on("roomJoined", (message: string, id: string, clients: number) => {
      console.log(message);
      setSocketId(id);
      setNumUsers(clients);
      setMessages((prev) => [...prev, message]);
    });

    socket.on("userJoined", (data: { id: string; clients: number }) => {
      const message = `User ${data.id} has joined the room`;
      console.log(message);
      setNumUsers(data.clients);
      setMessages((prev) => [...prev, message]);
    });

    socket.on("userLeft", (data: { id: string; clients: number }) => {
      const message = `User ${data.id} has left the room`;
      console.log(message);
      setNumUsers(data.clients);
      setMessages((prev) => [...prev, message]);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [roomcode]);

  return (
    <div className="text-center p-5">
      <h1 className="text-4xl mb-5">
        🎉 Welcome to Room: <strong>{roomcode}</strong> 🎉
      </h1>
      {socketId && (
        <h2 className="text-blue-500">
          Your Socket ID: <code>{socketId}</code>
        </h2>
      )}
      {numUsers !== null && (
        <h2 className="text-green-500">
          Users in Room: <strong>{numUsers}</strong>
        </h2>
      )}
      <p className="my-4">Open <a className="text-blue-600 underline"href="/a3b4" target="_blank">localhost:3001/a3b4</a> in an additional tab and check out the different socket.io messages when you join/leave the room. </p>
      <div className="mt-8">
        <h3 className="text-xl">📢 Socket.IO Messages:</h3>
        <ul className="list-none p-0">
          {messages.map((msg, idx) => (
            <li
              key={idx}
              className="my-2 p-2 rounded max-w-lg mx-auto "
            >
              {msg}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
