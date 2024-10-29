"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Users, Wifi, WifiOff } from "lucide-react";
import { initSocket } from "../../../lib/socket";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

export default function LobbyPage() {
  const params = useParams();
  const roomCode = params?.roomcode as string;
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "joined"
  >("connecting");
  const maxPlayers = 8;

  useEffect(() => {
    if (!roomCode) return;

    const socket = initSocket();

    const onConnect = () => {
      console.log("Socket connected");
      setIsConnected(true);
      setConnectionStatus("connected");
      socket.emit("joinRoom", roomCode);
    };

    const onDisconnect = () => {
      console.log("Socket disconnected");
      setIsConnected(false);
      setIsJoined(false);
      setConnectionStatus("connecting");
    };

    const onRoomJoined = (data: {
      message: string;
      currentPlayer: Player;
      players: Player[];
    }) => {
      console.log("Room joined", data);
      setIsJoined(true);
      setConnectionStatus("joined");
      setPlayerId(data.currentPlayer.id);
      setPlayers(data.players);
    };

    const onUserJoined = (data: { newPlayer: Player; players: Player[] }) => {
      console.log("User joined", data);
      setPlayers(data.players);
    };

    const onUserLeft = (data: { id: string; players: Player[] }) => {
      console.log("User left", data);
      setPlayers(data.players);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("roomJoined", onRoomJoined);
    socket.on("userJoined", onUserJoined);
    socket.on("userLeft", onUserLeft);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomJoined", onRoomJoined);
      socket.off("userJoined", onUserJoined);
      socket.off("userLeft", onUserLeft);
      socket.disconnect();
    };
  }, [roomCode]);

  const isHost = players.find((p) => p.id === playerId)?.isHost || false;

  const copyRoomCode = async () => {
    const apiUrl =
      process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_API_URL_PROD
        : process.env.NEXT_PUBLIC_API_URL_DEV;

    try {
      await navigator.clipboard.writeText(`${apiUrl}/room/${roomCode}`);
    } catch (err) {
      console.error("Failed to copy room code:", err);
    }
  };

  const startGame = () => {
    if (!isHost || !isConnected) return;
    const socket = initSocket();
    socket.emit("startGame", roomCode);
  };

  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case "connecting":
        return {
          icon: <WifiOff className="h-6 w-6 text-red-500" />,
          text: "Connecting to server...",
        };
      case "connected":
        return {
          icon: <Wifi className="h-6 w-6 text-yellow-500" />,
          text: "Connected, joining room...",
        };
      case "joined":
        return {
          icon: <Wifi className="h-6 w-6 text-green-500" />,
          text: "Connected to room",
        };
      default:
        return {
          icon: <WifiOff className="h-6 w-6 text-red-500" />,
          text: "Connecting...",
        };
    }
  };

  const connectionDisplay = getConnectionDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 mb-4">
            {connectionDisplay.icon}
            <span className="text-sm font-medium">
              {connectionDisplay.text}
            </span>
          </div>
          <CardTitle className="text-3xl font-bold text-center">
            Lobby
          </CardTitle>
          <CardDescription className="text-center text-lg">
            {isJoined
              ? "Waiting for players to join..."
              : "Connecting to room..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="text-2xl font-bold">{roomCode}</div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyRoomCode}
              disabled={!isJoined}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center">
              <Users className="mr-2" /> Players ({players.length}/{maxPlayers})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {players.map((player) => (
                <div key={player.id} className="flex items-center space-x-2">
                  <Avatar>
                    <AvatarImage src={player.avatar} alt={player.name} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span>{player.name}</span>
                    {player.isHost && (
                      <span className="text-xs text-purple-500">Host</span>
                    )}
                    {player.id === playerId && (
                      <span className="text-xs text-blue-500">(You)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            size="lg"
            className="w-full md:w-auto"
            onClick={startGame}
            disabled={!isHost || !isJoined || players.length < 2}
          >
            {isHost ? "Start Game" : "Waiting for host to start..."}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
