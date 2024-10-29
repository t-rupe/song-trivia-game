"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Home, RotateCcw } from "lucide-react";
import { initSocket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import { GamePlayer } from "@/types/game";

interface GameOverContentProps {
  standings: GamePlayer[];
  winner: GamePlayer;
  roomCode: string;
}

export default function GameOverContent({ standings, winner, roomCode }: GameOverContentProps) {
  const router = useRouter();

  const handlePlayAgain = () => {
    console.log("Requesting play again for room:", roomCode);
    const socket = initSocket();
    socket.emit("playAgain", roomCode);
  };

  const handleReturnHome = () => {
    console.log("Returning to home");
    const socket = initSocket();
    socket.emit("leaveRoom", roomCode);
    router.push('/');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center">Game Over</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto text-yellow-400" />
          <p className="text-2xl font-semibold mt-4">
            {winner.name} wins!
          </p>
        </div>
        <div className="space-y-4">
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0 ? 'bg-yellow-100' : 'bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={player.avatar} alt={player.name} />
                  <AvatarFallback>{player.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-semibold">{player.name}</span>
                  {index === 0 && <span className="ml-2 text-yellow-600">👑</span>}
                </div>
              </div>
              <span className="font-bold">{player.finalScore.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-center space-x-4">
        <Button onClick={handlePlayAgain}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Play Again
        </Button>
        <Button variant="outline" onClick={handleReturnHome}>
          <Home className="w-4 h-4 mr-2" />
          Return Home
        </Button>
      </CardFooter>
    </Card>
  );
}