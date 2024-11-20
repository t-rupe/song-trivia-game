"use client";
import { useState, useEffect, useRef } from "react";
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

declare global {
  interface Window {
    YT: any;
  }
}

export default function GameContent() {
  const params = useParams();
  const roomCode = params?.roomcode as string;
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState<number | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songId, setCurrentSongId] = useState<string | null>(null);
  const [message, setMessage] = useState("Now Playing");
  const [isPlaying, setIsPlaying] = useState(false); // Can be used to populate other UI elements if needed
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lastAnswerResult, setLastAnswerResult] = useState<{
    correct: boolean;
    points: number;
  } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const playerRef = useRef<YT.Player | null>(null); 


  // Check that the YouTube API is available before a round starts
  useEffect(() => {
    const waitForYouTubeAPI = new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (window.YT) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
    
    waitForYouTubeAPI.then(() => {
      console.log("YouTube API is ready");
    });
  }, []);

  // Load the YouTube API
  useEffect(() => {
    const loadYouTubeApi = () => {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onload = () => {
        console.log("YouTube Iframe API loaded");
      };
      document.body.appendChild(script);
    };
    loadYouTubeApi();
  }, []);

  // Play the song from the YouTube API
  const startYouTubePlayer = (songId: string) => {
    if (window.YT) {
      if (playerRef.current) {
        console.log("Destroying previous player");
        playerRef.current.destroy();
      }

      playerRef.current = new YT.Player("audio-player", {
        videoId: songId,
        playerVars: {
          controls: 0, // Do not show controls to players
          modestbranding: 1,
          fs: 0,
          iv_load_policy: 3,
          autoplay: 1,
          mute: 0,
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
            console.log("Player ready, seek to 60 seconds..."); // Start the song 60 seconds into the video - buffer
            event.target.seekTo(60, true); // Skip to 60 seconds in
            event.target.playVideo();

            setIsPlaying(true);
            setMessage("Now Playing..."); // Set the UI message to Now Playing

            setTimeout(() => {
              event.target.stopVideo();
              console.log("Stop playing song after 7 seconds");
              setIsPlaying(false);
              setMessage("Snippet Ended...");
            }, 10000); // Pause the song after 10 seconds - remaining time is used for guessing
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (event.data === YT.PlayerState.ENDED) {
              setIsPlaying(false);
              setMessage("Waiting for New Round...");
              console.log("Song is over for the round");
            }
          },
        },
      });
    } else {
      console.error("YouTube API is not loaded");
    }
  };

  useEffect(() => {
    const socket = initSocket();

    // Fetch initial game state when the component mounts
    socket.emit("get_initial_game_state", { roomCode });

    // Listen for the initial game state
    socket.on("initial_game_state", (data: { maxRounds: number }) => {
    setMaxRounds(data.maxRounds);
    });

    const onNewRound = (data: {
      roundNumber: number;
      maxRounds: number;
      song: Song;
      songId: string;
    }) => {
      console.log('New round received:', data);
      setCurrentRound(data.roundNumber);
      setMaxRounds(data.maxRounds);
      setCurrentSong(data.song);
      setCurrentSongId(data.songId);
      setSelectedAnswer(null);
      setLastAnswerResult(null);

      // On new round, trigger the YouTube player
      if (data.songId) {
        console.log("New round, initializing YouTube player with songId:", songId);
        startYouTubePlayer(data.songId);
      }
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
        {maxRounds !== null ? `Round ${currentRound === 0 ? 1 : currentRound} of ${maxRounds}` : "Loading..."}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Invisible YouTube Player */}
        <div id="audio-player" style={{ display: "none" }}></div>

        {/* Fixed height container for main content */}
        <div className="space-y-6 min-h-[400px]">
          {/* Timer and Now Playing section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Music className="w-6 h-6 text-purple-600" />
              {/* Dynamically display message */}
              <span className= "font-semibold">{message}</span> 
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