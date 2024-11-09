"use client";
import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { LobbyContent } from "@/components/lobby-content";
import GameContent from "@/components/game-content";
import GameOverContent from "@/components/game-over-content";
import { initSocket } from "@/lib/socket";
import { BasePlayer, GamePlayer, GamePhase, GameState } from "@/types/game";

export default function RoomPage() {
  const params = useParams();
  const roomCode = params?.roomcode as string;

  if (!roomCode || roomCode.length !== 4) {
    notFound();
  }
  const [gamePhase, setGamePhase] = useState<GamePhase>("lobby");
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<BasePlayer[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "joined"
  >("connecting");
  const [gameOverData, setGameOverData] = useState<{
    standings: GamePlayer[];
    winner: GamePlayer;
  } | null>(null);

  const socket = initSocket();

  useEffect(() => {
    if (!roomCode) {
      console.log("No room code provided");
      return;
    }

    console.log("Initializing socket connection for room:", roomCode);
    const socket = initSocket();

    const onConnect = () => {
      console.log("Socket connected, setting states...");
      setConnectionStatus("connected");
      console.log("Emitting joinRoom event for room:", roomCode);
      socket.emit("joinRoom", roomCode);
    };

    const onDisconnect = () => {
      console.log("Socket disconnected, resetting states...");
      setIsJoined(false);
      setConnectionStatus("connecting");
      setPlayers([]); // Reset players on disconnect
    };

    const onRoomJoined = (data: {
      message: string;
      currentPlayer: BasePlayer;
      players: BasePlayer[];
      gameState: GameState;
    }) => {
      console.log("Room joined event received:", data);
      setIsJoined(true);
      setConnectionStatus("joined");
      setPlayerId(data.currentPlayer.id);
      setPlayers(data.players);
      setGamePhase(data.gameState.phase);

      // If rejoining during game over, restore the game over data
      if (
        data.gameState.phase === "gameOver" &&
        data.gameState.finalStandings
      ) {
        setGameOverData({
          standings: data.gameState.finalStandings,
          winner: data.gameState.finalStandings[0],
        });
      }
    };

    const onUserJoined = (data: {
      newPlayer: BasePlayer;
      players: BasePlayer[];
    }) => {
      console.log("User joined event received:", data);
      setPlayers(data.players);
    };

    const onUserLeft = (data: { id: string; players: BasePlayer[] }) => {
      console.log("User left event received:", data);
      setPlayers(data.players);
    };

    const onGameStart = () => {
      console.log("Game start event received");
      setGamePhase("playing");
    };

    const onGameOver = (data: {
      standings: GamePlayer[];
      winner: GamePlayer;
    }) => {
      console.log("Game over received:", data);
      setGameOverData(data);
      setGamePhase("gameOver");
    };

    const onGameReset = (data: { phase: GamePhase; players: BasePlayer[] }) => {
      console.log("Game reset received:", data);
      setGamePhase(data.phase);
      setPlayers(data.players);
      setGameOverData(null);
    };

    // Add error event handler
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnectionStatus("connecting");
    });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("roomJoined", onRoomJoined);
    socket.on("userJoined", onUserJoined);
    socket.on("userLeft", onUserLeft);
    socket.on("gameStart", onGameStart);
    socket.on("game_over", onGameOver);
    socket.on("gameReset", onGameReset);

    if (!socket.connected) {
      console.log("Socket not connected, initiating connection...");
      socket.connect();
    } else {
      console.log("Socket already connected");
      onConnect();
    }

    return () => {
      console.log("Cleaning up socket event listeners...");
      // Only remove event listeners, don't disconnect
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomJoined", onRoomJoined);
      socket.off("userJoined", onUserJoined);
      socket.off("userLeft", onUserLeft);
      socket.off("gameStart", onGameStart);
      socket.off("game_over", onGameOver);
      socket.off("gameReset", onGameReset);
      socket.off("connect_error");

      // Only disconnect if actually leaving the page/room
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes(roomCode)
      ) {
        console.log("Leaving room, disconnecting socket");
        socket.disconnect();
      }
    };
  }, [roomCode]);

  const handleStartGame = () => {
    console.log("Attempting to start game for room:", roomCode);
    const socket = initSocket();
    socket.emit("startGame", roomCode);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-purple-600 to-blue-600 flex items-center justify-center p-4">
      {gamePhase === "lobby" && (
        <LobbyContent
          roomCode={roomCode}
          isJoined={isJoined}
          players={players}
          playerId={playerId}
          connectionStatus={connectionStatus}
          onStartGame={handleStartGame}
          socket={socket} // Pass the socket to LobbyContent
        />
      )}
      {gamePhase === "playing" && <GameContent />}
      {gamePhase === "gameOver" && gameOverData && (
        <GameOverContent
          standings={gameOverData.standings}
          winner={gameOverData.winner}
          roomCode={roomCode}
        />
      )}
    </div>
  );
}
