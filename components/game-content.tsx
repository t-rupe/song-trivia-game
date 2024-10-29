"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Music } from "lucide-react";
import { initSocket } from "@/lib/socket";
import { useParams } from "next/navigation";

interface Song {
  id: string;
  previewUrl: string;
  title: string;
  artist: string;
  options: string[];
  correctAnswer?: string;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
}

export default function GameContent() {
  const params = useParams();
  const roomCode = params?.roomcode as string;
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(10);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lastAnswerResult, setLastAnswerResult] = useState<{
    correct: boolean;
    points: number;
  } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const socket = initSocket();

    const onNewRound = (data: {
      roundNumber: number;
      maxRounds: number;
      song: Song;
    }) => {
      console.log('New round received:', data);
      setCurrentRound(data.roundNumber);
      setMaxRounds(data.maxRounds);
      setCurrentSong(data.song);
      setSelectedAnswer(null);
      setLastAnswerResult(null);
    };

    const onTimeUpdate = (time: number) => {
      setTimeLeft(time);
    };

    const onAnswerResult = (result: {
      correct: boolean;
      points: number;
      correctAnswer: string;
    }) => {
      console.log('Answer result received:', result);
      setLastAnswerResult(result);
    };

    const onScoreUpdate = (data: {
      scores: { [key: string]: number };
      players: Player[];
    }) => {
      console.log('Score update received:', data);
      setPlayers(data.players);
    };

    socket.on('new_round', onNewRound);
    socket.on('time_update', onTimeUpdate);
    socket.on('answer_result', onAnswerResult);
    socket.on('score_update', onScoreUpdate);

    return () => {
      socket.off('new_round', onNewRound);
      socket.off('time_update', onTimeUpdate);
      socket.off('answer_result', onAnswerResult);
      socket.off('score_update', onScoreUpdate);
    };
  }, []);  

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    const socket = initSocket();
    socket.emit('submit_answer', { roomCode, answer });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Round {currentRound} of {maxRounds}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Fixed height container for main content */}
        <div className="space-y-6 min-h-[400px]">
          {/* Timer and Now Playing section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Music className="w-6 h-6 text-purple-600" />
              <span className="font-semibold">Now Playing</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{timeLeft}s</span>
              <Progress value={(timeLeft / 30) * 100} className="w-20" />
            </div>
          </div>

          <div className="h-[200px]">
            <p className="text-xl font-semibold text-center mb-4">
              Guess the Song!
            </p>

            {lastAnswerResult && (
              <div className="absolute left-1/2 transform -translate-x-1/2 top-4 z-50">
                <div className={`px-4 py-2 rounded-md shadow-lg ${
                  lastAnswerResult.correct 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {lastAnswerResult.correct 
                    ? `Correct! +${lastAnswerResult.points} points` 
                    : 'Incorrect!'}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {currentSong?.options.map((option, index) => (
                <Button
                  key={index}
                  variant={
                    selectedAnswer === option
                      ? lastAnswerResult
                        ? lastAnswerResult.correct
                          ? "success"
                          : "destructive"
                        : "default"
                      : "outline"
                  }
                  className="h-20 text-lg"
                  onClick={() => handleAnswer(option)}
                  disabled={!!selectedAnswer}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* Players list */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Players:</h3>
            <div className="grid grid-cols-2 gap-4">
              {players.map((player) => (
                <div key={player.id} className="flex items-center space-x-2">
                  <Avatar>
                    <AvatarImage src={player.avatar} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div>{player.name}</div>
                    <div className="text-sm text-gray-500">
                      Score: {player.score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}