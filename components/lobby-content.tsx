"use client";
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

import { useState, useEffect } from "react";


// AvatarSelector Component for the current player
function AvatarSelector({avatar, onNewAvatarClick }: any) {
  return (
    <div className="flex flex-col items-center">
      {avatar ? (
        <img
          src={avatar}
          alt="Player Avatar"
          className="rounded-full w-20 h-20 mb-2 cursor-pointer"
          onClick={onNewAvatarClick}
        />
      ) : (
        <div className="rounded-full w-20 h-20 mb-2 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

interface LobbyContentProps {
  roomCode: string;
  isJoined: boolean;
  players: Player[];
  playerId: string | null;
  connectionStatus: "connecting" | "connected" | "joined";
  onStartGame: () => void;
  socket: any;
  maxRounds: number; 
  onSetMaxRounds: (value: number) => void;
}

export function LobbyContent({
  roomCode,
  isJoined,
  players,
  playerId,
  connectionStatus,
  onStartGame,
  socket,
  maxRounds,
  onSetMaxRounds,
}: LobbyContentProps)  {
  const maxPlayers = 8;
  const isHost = players.find((p) => p.id === playerId)?.isHost || false;
  const [updatedPlayers, setUpdatedPlayers] = useState(players);

  useEffect(() => {
    setUpdatedPlayers(players);
  }, [players]);

  const copyRoomCode = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    try {
      await navigator.clipboard.writeText(`${baseUrl}/room/${roomCode}`);
    } catch (err) {
      console.error("Failed to copy room code:", err);
    }
  };

  const handleNewAvatarClick = () => {
    console.log("Requesting a new avatar for player:", playerId);
    socket.emit("refresh_avatar", { playerId });
  };

  useEffect(() => {
    socket.on("updated_avatar", (data: any) => {
      console.log("Received updated avatar for player:", data);
      setUpdatedPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === data.playerId
            ? { ...player, avatar: data.avatar }
            : player
        )
      );
    });
  
    return () => {
      socket.off("updated_avatar");
    };
  }, []);

  const connectionDisplay = {
    connecting: {
      icon: <WifiOff className="h-6 w-6 text-red-500" />,
      text: "Connecting to server...",
    },
    connected: {
      icon: <Wifi className="h-6 w-6 text-yellow-500" />,
      text: "Connected, joining room...",
    },
    joined: {
      icon: <Wifi className="h-6 w-6 text-green-500" />,
      text: "Connected to room",
    },
  }[connectionStatus];

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-center gap-2 mb-4">
          {connectionDisplay.icon}
          <span className="text-sm font-medium">{connectionDisplay.text}</span>
        </div>
        <CardTitle className="text-3xl font-bold text-center">Lobby</CardTitle>
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
        {isHost && (
          <div className="flex flex-col items-center space-y-2">
            <label htmlFor="maxRounds" className="text-sm font-medium">
              Max Rounds
            </label>
            <input
              type="number"
              id="maxRounds"
              value={maxRounds}
              min={1}
              max={10}
              onChange={(e) => onSetMaxRounds(Number(e.target.value))}
              className="border rounded px-2 py-1 text-center"
            />
          </div>
        )}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center">
            <Users className="mr-2" /> Players ({players.length}/{maxPlayers})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {updatedPlayers.map((player) => (
              <div key={player.id} className="flex items-center space-x-2">
                {player.id === playerId ? (
                  <AvatarSelector
                  playerId={playerId}
                  avatar={player.avatar}
                  onNewAvatarClick={handleNewAvatarClick}
                />
              ) : (
                <Avatar>
                  <AvatarImage src={player.avatar} alt={player.name} />
                  <AvatarFallback>{player.name[0]}</AvatarFallback>
                </Avatar>
              )}
                <div className="flex flex-col">
                  {player.id === playerId ? (
                    
                    <>
                      
                    </>
                  ) : (
                    <span>{player.name}</span>
                  )}
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
          onClick={onStartGame}
          disabled={!isHost || !isJoined || players.length < 2}
        >
          {isHost ? "Start Game" : "Waiting for host to start..."}
        </Button>
      </CardFooter>
    </Card>
  );
}
