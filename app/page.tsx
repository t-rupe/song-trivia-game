"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Music, Users, Play, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { initSocket } from "../lib/socket";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const socket = initSocket();

    const onConnect = () => {
      setIsConnected(true);
      console.log("Connected to server");
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log("Disconnected from server");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // Cleanup on unmount
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, []);

  const generateRoomCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  };
  
  const createLobby = () => {
    if (!isConnected) return;
    const roomCode = generateRoomCode();
    router.push(`/room/${roomCode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-center gap-2">
            {isConnected ? (
              <Wifi className="h-6 w-6 text-green-500" />
            ) : (
              <WifiOff className="h-6 w-6 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {isConnected ? "Connected to server" : "Connecting..."}
            </span>
          </div>
          <CardTitle className="text-3xl font-bold text-center">
            Song Trivia Challenge
          </CardTitle>
          <CardDescription className="text-center text-lg">
            Test your music knowledge in real-time!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">How to Play:</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Create a lobby or join an existing one</li>
              <li>Listen to song snippets and guess the title or artist</li>
              <li>Score points for correct answers and speed</li>
              <li>Compete against friends in real-time</li>
            </ul>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center">
              <Music className="h-12 w-12 mb-2 text-purple-600" />
              <h3 className="font-semibold">Diverse Music</h3>
              <p className="text-sm text-gray-600">
                From classics to current hits
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Users className="h-12 w-12 mb-2 text-purple-600" />
              <h3 className="font-semibold">Multiplayer</h3>
              <p className="text-sm text-gray-600">
                Play with friends
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Play className="h-12 w-12 mb-2 text-purple-600" />
              <h3 className="font-semibold">Real-time Action</h3>
              <p className="text-sm text-gray-600">
                Answer quickly to score the most points
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            size="lg"
            className="w-full md:w-auto"
            onClick={createLobby}
            disabled={!isConnected}
          >
            Create a Lobby
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
