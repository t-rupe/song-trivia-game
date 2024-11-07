const OpenAI = require("openai");
// For privacy, I am using the SDK format to retrieve the key
// Currently, using a personal paid account for API key usage
// Creates an instance of the OpenAI client with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Game state management
const gameRooms = new Map();
const socketToRoom = new Map();
const roomTimers = new Map();

const ROUND_TIME = 15; // seconds
const MAX_ROUNDS = 3;
const NUM_OPTIONS = 4; // Total answer options per round, including 1 correct answer
const RATE_LIMIT_DELAY = 1000; // Delay between requests in milliseconds


// For now using, a fixed set of genres 
const genres = [
  "Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Blues", "R&B", "Soul", 
  "Country", "Electronic", "Reggae", "Funk", "Disco", "Folk", "Metal", 
  "Punk", "Alternative", "Indie Rock", "K-Pop"
];

// Helper Functions
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function cleanupRoom(roomCode) {
  const gameState = gameRooms.get(roomCode);
  if (!gameState) return;

  if (roomTimers.has(roomCode)) {
    clearInterval(roomTimers.get(roomCode));
    roomTimers.delete(roomCode);
  }

  // Only delete room if empty
  if (gameState.players.length === 0) {
    gameRooms.delete(roomCode);
  }
}

function initializeGameState(roomCode) {
  return {
    roomCode,
    phase: "lobby",
    players: [],
    currentRound: 0,
    maxRounds: MAX_ROUNDS,
    scores: {},
    currentSong: null,
    roundStartTime: null,
    roundTimeLeft: ROUND_TIME,
    answers: new Map(),
    finalStandings: null,
    playerData: new Map(),
  };
}

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? `https://songtrivia.us`
          : "http://localhost:3001",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  async function startNewRound(roomCode) {
    console.log("Starting new round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) {
      console.log("Cannot start round - game state not found");
      return;
    }

    gameState.currentRound++;
    console.log(
      `Round ${gameState.currentRound} starting for room ${roomCode}`
    );

    // Clear previous round data
    gameState.answers.clear();
    gameState.roundTimeLeft = ROUND_TIME;
    gameState.roundStartTime = Date.now();

    // Check if game should end
    if (gameState.currentRound > MAX_ROUNDS) {
      endGame(roomCode);
      return;
    }

    // Mock song data with shuffled options
    const options = [
      "Example Song",
      "Wrong Song 1",
      "Wrong Song 2",
      "Wrong Song 3",
    ];
    const shuffledOptions = shuffleArray([...options]);

    const mockSong = {
      id: Math.random().toString(),
      previewUrl: "https://example.com/song.mp3",
      title: "Example Song",
      artist: "Example Artist",
      correctAnswer: "Example Song",
      options: shuffledOptions,
    };

    gameState.currentSong = mockSong;

    console.log(
      `Broadcasting round ${gameState.currentRound} to all players in room ${roomCode}`,
      {
        songData: mockSong,
        playerCount: gameState.players.length,
      }
    );

    // Verify game state before broadcasting
    if (!verifyGameState(io, roomCode)) {
      console.log("Game state verification failed, cleaning up room");
      cleanupRoom(roomCode);
      return;
    }

    // Broadcast to ALL players in the room
    io.in(roomCode).emit("new_round", {
      roundNumber: gameState.currentRound,
      maxRounds: gameState.maxRounds,
      song: mockSong,
    });

    // Start the timer for this round
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    const timer = setInterval(() => {
      if (
        !gameState ||
        !gameState.roundTimeLeft ||
        gameState.roundTimeLeft <= 0
      ) {
        clearInterval(timer);
        endRound(roomCode);
        return;
      }

      gameState.roundTimeLeft--;
      io.in(roomCode).emit("time_update", gameState.roundTimeLeft);
    }, 1000);

    roomTimers.set(roomCode, timer);
  }

  function handleNewConnection(socket, roomCode) {
    console.log(`Socket ${socket.id} attempting to join room ${roomCode}`);

    // Cleanup previous room if exists
    const prevRoom = socketToRoom.get(socket.id);
    if (prevRoom) {
      handlePlayerLeaving(socket, prevRoom);
    }

    // Initialize or get room state
    let gameState = gameRooms.get(roomCode);
    if (!gameState) {
      console.log(`Creating new game state for room ${roomCode}`);
      gameState = initializeGameState(roomCode);
      gameRooms.set(roomCode, gameState);
    }

    const isFirstPlayer = gameState.players.length === 0;

    // Create new player
    const newPlayer = {
      id: socket.id,
      name: `Player ${gameState.players.length + 1}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`,
      isHost: isFirstPlayer,
      score: 0,
    };

    // Store player data for reconnection handling
    gameState.playerData.set(socket.id, {
      ...newPlayer,
      joinTime: Date.now(),
      lastActive: Date.now(),
    });

    // Add player to game state
    gameState.players.push(newPlayer);
    gameState.scores[socket.id] = 0;
    socketToRoom.set(socket.id, roomCode);

    // Join the socket room
    socket.join(roomCode);

    // Send current game state to the joining player
    socket.emit("roomJoined", {
      message: `You have joined room: ${roomCode}`,
      currentPlayer: newPlayer,
      players: gameState.players,
      gameState: {
        phase: gameState.phase,
        currentRound: gameState.currentRound,
        timeLeft: gameState.roundTimeLeft,
        scores: gameState.scores,
        finalStandings: gameState.finalStandings,
      },
    });

    // If joining during an active game, send current round data
    if (gameState.phase === "playing" && gameState.currentSong) {
      socket.emit("new_round", {
        roundNumber: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        song: gameState.currentSong,
      });
      socket.emit("time_update", gameState.roundTimeLeft);
    }

    // Notify others in the room
    socket.to(roomCode).emit("userJoined", {
      newPlayer,
      players: gameState.players,
    });

    // Set up disconnect handler for this connection
    socket.on("disconnect", () => {
      // Update last active timestamp
      const playerData = gameState.playerData.get(socket.id);
      if (playerData) {
        playerData.lastActive = Date.now();
        gameState.playerData.set(socket.id, playerData);
      }

      // Don't remove player data immediately on disconnect
      // This allows for reconnection
      setTimeout(() => {
        // If player hasn't reconnected after timeout, clean up
        const currentPlayerData = gameState.playerData.get(socket.id);
        if (
          currentPlayerData &&
          currentPlayerData.lastActive === playerData.lastActive
        ) {
          console.log(
            `Player ${socket.id} did not reconnect, cleaning up data`
          );
          gameState.playerData.delete(socket.id);
        }
      }, 120000); // 2 minute timeout for reconnection
    });

    console.log(`Room ${roomCode} updated players:`, gameState.players);
  }

  function endRound(roomCode) {
    console.log("Ending round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    // Clear round timer
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    if (!verifyGameState(io, roomCode)) {
      console.log("Game state verification failed during round end");
      return;
    }

    // Send round results to all players
    io.in(roomCode).emit("round_end", {
      correctAnswer: gameState.currentSong.correctAnswer,
      scores: gameState.scores,
      answers: Array.from(gameState.answers.entries()).map(
        ([playerId, data]) => ({
          player: gameState.players.find((p) => p.id === playerId),
          ...data,
        })
      ),
    });

    // Check if game should end
    if (gameState.currentRound >= MAX_ROUNDS) {
      console.log(`Maximum rounds (${MAX_ROUNDS}) reached, ending game`);
      endGame(roomCode);
      return;
    }

    // Start next round after delay
    console.log(`Starting next round in 5 seconds for room ${roomCode}`);
    setTimeout(() => {
      if (verifyGameState(io, roomCode)) {
        startNewRound(roomCode);
      }
    }, 5000);
  }

  function endGame(roomCode) {
    console.log("Ending game for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    // Clear any existing timers but DON'T disconnect players
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    // Calculate final standings
    const standings = gameState.players
      .map((player) => ({
        ...player,
        finalScore: gameState.scores[player.id] || 0,
      }))
      .sort((a, b) => b.finalScore - a.finalScore);

    // Store final standings in game state
    gameState.finalStandings = standings;
    gameState.phase = "gameOver";

    // Verify game state before sending final results
    if (!verifyGameState(io, roomCode)) {
      console.log("Game state verification failed during game end");
      return;
    }

    // Notify all players of game end
    io.in(roomCode).emit("game_over", {
      standings,
      winner: standings[0],
    });
  }

  function handlePlayerLeaving(socket, roomCode) {
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    console.log(`Player ${socket.id} leaving room ${roomCode}`);

    // Remove player from game state
    const playerIndex = gameState.players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== -1) {
      const wasHost = gameState.players[playerIndex].isHost;
      gameState.players.splice(playerIndex, 1);
      delete gameState.scores[socket.id];

      // If player was host, assign new host
      if (wasHost && gameState.players.length > 0) {
        gameState.players[0].isHost = true;
      }

      // Remove room if empty
      if (gameState.players.length === 0) {
        console.log(`Room ${roomCode} is empty, cleaning up`);
        cleanupRoom(roomCode);
      } else {
        // Notify remaining players
        socket.to(roomCode).emit("userLeft", {
          id: socket.id,
          players: gameState.players,
        });

        // If game is in progress and there's only one player left, end the game
        if (gameState.phase === "playing" && gameState.players.length === 1) {
          endGame(roomCode);
        }
      }
    }

    socket.leave(roomCode);
  }

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Handle rejoining rooms
    socket.on("rejoinRoom", async ({ roomCode, playerId }) => {
      console.log(`Player ${playerId} attempting to rejoin room ${roomCode}`);

      const gameState = gameRooms.get(roomCode);
      if (!gameState) {
        socket.emit("roomError", { message: "Room not found" });
        return;
      }

      // If we have stored player data, restore it
      const existingPlayerData = gameState.playerData.get(playerId);
      if (existingPlayerData) {
        // Update the player's new socket ID while preserving their data
        const playerIndex = gameState.players.findIndex(
          (p) => p.id === playerId
        );
        if (playerIndex !== -1) {
          gameState.players[playerIndex].id = socket.id;
          // Update scores
          if (gameState.scores[playerId]) {
            gameState.scores[socket.id] = gameState.scores[playerId];
            delete gameState.scores[playerId];
          }
        }

        socket.join(roomCode);
        socketToRoom.set(socket.id, roomCode);

        // Send current game state to rejoining player
        socket.emit("roomRejoined", {
          message: `Rejoined room: ${roomCode}`,
          currentPlayer: { ...existingPlayerData, id: socket.id },
          players: gameState.players,
          gameState: {
            phase: gameState.phase,
            currentRound: gameState.currentRound,
            timeLeft: gameState.roundTimeLeft,
            scores: gameState.scores,
            finalStandings: gameState.finalStandings,
          },
        });

        // If joining during an active game, send current round data
        if (gameState.phase === "playing" && gameState.currentSong) {
          socket.emit("new_round", {
            roundNumber: gameState.currentRound,
            maxRounds: gameState.maxRounds,
            song: gameState.currentSong,
          });
          socket.emit("time_update", gameState.roundTimeLeft);
        }

        // Notify others
        socket.to(roomCode).emit("userRejoined", {
          player: { ...existingPlayerData, id: socket.id },
          players: gameState.players,
        });
      } else {
        // Handle as new connection if no existing data
        handleNewConnection(socket, roomCode);
      }
    });

    socket.on("joinRoom", (roomCode) => {
      handleNewConnection(socket, roomCode);
    });

    socket.on("startGame", async (roomCode) => {
      console.log(`Starting game in room ${roomCode}`);
      const gameState = gameRooms.get(roomCode);

      if (!gameState || gameState.phase !== "lobby") {
        console.log("Cannot start game - invalid game state");
        return;
      }

      const hostPlayer = gameState.players.find((p) => p.isHost);
      if (hostPlayer?.id !== socket.id) {
        console.log("Cannot start game - not host");
        return;
      }

      /**
       * *** OpenAI API Integration ***
       * Fetch random songs when the game starts.
       */
      const rounds = []; // Store each round's data
      for (let i = 0; i < MAX_ROUNDS; i++) {
        const selectedGenre = getRandomGenre();
        const songSuggestions = await getSongAndArtistByGenre(selectedGenre, NUM_OPTIONS);

        // Skip round if there was an error or not enough suggestions returned
        if (!songSuggestions || songSuggestions.length < NUM_OPTIONS) continue;

        // First suggestion is the correct answer; others are incorrect answers
        const correctAnswer = songSuggestions[0];
        const incorrectAnswers = songSuggestions.slice(1);
        console.log("incorrectAnswers", songSuggestions.slice(1)); 

        // Store the round data in the specified format
        rounds.push({
            genre: selectedGenre,
            correctAnswer,
            incorrectAnswers
        });
        // Introduce a delay after each round (before the next API call)
        await delay(RATE_LIMIT_DELAY);
      }
      console.log("All Rounds Data:", JSON.stringify(rounds, null, 2)); 
    

      if (!rounds || rounds.length !== MAX_ROUNDS) {
        console.log("Failed to fetch the required number of rounds from OpenAI");
        // Handle error, possibly notify players and end the game
        io.in(roomCode).emit("error", {
          message: "Failed to fetch all rounds. Please try again later.",
        });
        cleanupRoom(roomCode);
        return;
      }

      gameState.songList = rounds; // Store the fetched songs in game state

      gameState.phase = "playing";
      gameState.currentRound = 0;
      gameState.scores = {};
      gameState.finalStandings = null;
      gameState.players.forEach((player) => {
        gameState.scores[player.id] = 0;
        player.score = 0;
      });

      console.log("Game phase updated to playing, starting first round");
      io.to(roomCode).emit("gameStart");
      await startNewRound(roomCode);
    });

    socket.on("submit_answer", ({ roomCode, answer }) => {
      const gameState = gameRooms.get(roomCode);

      if (!gameState || gameState.phase !== "playing") {
        console.log("Cannot submit answer - invalid game state");
        return;
      }

      if (!gameState.answers.has(socket.id)) {
        const timeElapsed = ROUND_TIME - gameState.roundTimeLeft;
        gameState.answers.set(socket.id, {
          answer,
          timeElapsed,
        });

        if (answer === gameState.currentSong.correctAnswer) {
          const timeBonus = Math.floor(
            (gameState.roundTimeLeft / ROUND_TIME) * 500
          );
          const points = 1000 + timeBonus;
          gameState.scores[socket.id] =
            (gameState.scores[socket.id] || 0) + points;

          gameState.players = gameState.players.map((player) => {
            if (player.id === socket.id) {
              return { ...player, score: gameState.scores[socket.id] };
            }
            return player;
          });

          socket.emit("answer_result", {
            correct: true,
            points,
            correctAnswer: gameState.currentSong.correctAnswer,
          });
        } else {
          socket.emit("answer_result", {
            correct: false,
            points: 0,
            correctAnswer: gameState.currentSong.correctAnswer,
          });
        }

        io.in(roomCode).emit("score_update", {
          scores: gameState.scores,
          players: gameState.players.map((player) => ({
            ...player,
            score: gameState.scores[player.id] || 0,
          })),
        });

        if (gameState.answers.size === gameState.players.length) {
          endRound(roomCode);
        }
      }
    });

    socket.on("playAgain", (roomCode) => {
      console.log(`Play again requested for room ${roomCode}`);
      const gameState = gameRooms.get(roomCode);
      if (!gameState) return;

      gameState.phase = "lobby";
      gameState.currentRound = 0;
      gameState.scores = {};
      gameState.currentSong = null;
      gameState.answers.clear();
      gameState.finalStandings = null;
      gameState.roundTimeLeft = ROUND_TIME;

      gameState.players = gameState.players.map((player) => ({
        ...player,
        score: 0,
      }));

      // Notify all players of reset
      io.to(roomCode).emit("gameReset", {
        phase: "lobby",
        players: gameState.players,
      });
    });

    socket.on("leaveRoom", (roomCode) => {
      console.log(`Player ${socket.id} leaving room ${roomCode}`);
      handlePlayerLeaving(socket, roomCode);
    });

    socket.on("disconnecting", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (roomCode) {
        handlePlayerLeaving(socket, roomCode);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      socketToRoom.delete(socket.id);
    });
  });

  async function startNewRound(roomCode) {
    console.log("Starting new round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) {
      console.log("Cannot start round - game state not found");
      return;
    }

    gameState.currentRound++;
    console.log(
      `Round ${gameState.currentRound} starting for room ${roomCode}`
    );

    // Clear previous round data
    gameState.answers.clear();
    gameState.roundTimeLeft = ROUND_TIME;
    gameState.roundStartTime = Date.now();

    // Check if game should end
    if (gameState.currentRound > MAX_ROUNDS) {
      endGame(roomCode);
      return;
    }

    // Mock song data with shuffled options
    const options = [
      "Example Song",
      "Wrong Song 1",
      "Wrong Song 2",
      "Wrong Song 3",
    ];
    const shuffledOptions = options.sort(() => Math.random() - 0.5);

    const mockSong = {
      id: Math.random().toString(),
      previewUrl: "https://example.com/song.mp3",
      title: "Example Song",
      artist: "Example Artist",
      correctAnswer: "Example Song",
      options: shuffledOptions,
    };

    gameState.currentSong = mockSong;

    // Log the broadcast attempt
    console.log(
      `Broadcasting round ${gameState.currentRound} to all players in room ${roomCode}`,
      {
        songData: mockSong,
        playerCount: gameState.players.length,
      }
    );

    // Broadcast to ALL players in the room
    io.in(roomCode).emit("new_round", {
      roundNumber: gameState.currentRound,
      maxRounds: gameState.maxRounds,
      song: mockSong,
    });

    // Start the timer for this round
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    const timer = setInterval(() => {
      if (
        !gameState ||
        !gameState.roundTimeLeft ||
        gameState.roundTimeLeft <= 0
      ) {
        clearInterval(timer);
        endRound(roomCode);
        return;
      }

      gameState.roundTimeLeft--;
      io.in(roomCode).emit("time_update", gameState.roundTimeLeft);
    }, 1000);

    roomTimers.set(roomCode, timer);
  }

  function endRound(roomCode) {
    console.log("Ending round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    // Clear round timer
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    // Send round results to all players
    io.in(roomCode).emit("round_end", {
      correctAnswer: gameState.currentSong.correctAnswer,
      scores: gameState.scores,
      answers: Array.from(gameState.answers.entries()).map(
        ([playerId, data]) => ({
          player: gameState.players.find((p) => p.id === playerId),
          ...data,
        })
      ),
    });

    // Check if game should end
    if (gameState.currentRound >= MAX_ROUNDS) {
      console.log(`Maximum rounds (${MAX_ROUNDS}) reached, ending game`);
      endGame(roomCode);
      return;
    }

    // Start next round after delay
    console.log(`Starting next round in 5 seconds for room ${roomCode}`);
    setTimeout(() => {
      startNewRound(roomCode);
    }, 5000);
  }

  function verifyGameState(roomCode) {
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return false;

    // Verify all players are still connected
    const connectedPlayers = Array.from(
      io.sockets.adapter.rooms.get(roomCode) || []
    );
    const validPlayers = gameState.players.filter((player) =>
      connectedPlayers.includes(player.id)
    );

    // Update player list if needed
    if (validPlayers.length !== gameState.players.length) {
      gameState.players = validPlayers;
      if (validPlayers.length === 0) {
        gameRooms.delete(roomCode);
        return false;
      }
    }

    return true;
  }

  function endGame(roomCode) {
    console.log("Ending game for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    // Clear any existing timers but DON'T disconnect players
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    // Calculate final standings
    const standings = gameState.players
      .map((player) => ({
        ...player,
        finalScore: gameState.scores[player.id] || 0,
      }))
      .sort((a, b) => b.finalScore - a.finalScore);

    // Store final standings in game state
    gameState.finalStandings = standings;
    gameState.phase = "gameOver";

    // Notify all players of game end without forcing a disconnect
    io.in(roomCode).emit("game_over", {
      standings,
      winner: standings[0],
    });

    // Keep the game state intact for the game over screen
    gameState.currentSong = null;
    gameState.answers.clear();
  }

  function endRound(roomCode) {
    console.log("Ending round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    // Clear round timer
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    // Send round results to all players
    io.in(roomCode).emit("round_end", {
      correctAnswer: gameState.currentSong.correctAnswer,
      scores: gameState.scores,
      answers: Array.from(gameState.answers.entries()).map(
        ([playerId, data]) => ({
          player: gameState.players.find((p) => p.id === playerId),
          ...data,
        })
      ),
    });

    // Check if game should end
    if (gameState.currentRound >= MAX_ROUNDS) {
      console.log(`Maximum rounds (${MAX_ROUNDS}) reached, ending game`);
      // Don't start a new timer, just end the game
      endGame(roomCode);
    } else {
      // Only start next round if we haven't reached max rounds
      console.log(`Starting next round in 5 seconds for room ${roomCode}`);
      setTimeout(() => {
        startNewRound(roomCode);
      }, 5000);
    }
  }
  function handlePlayerLeaving(socket, roomCode) {
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    console.log(`Player ${socket.id} leaving room ${roomCode}`);

    // Remove player from game state
    const playerIndex = gameState.players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== -1) {
      const wasHost = gameState.players[playerIndex].isHost;
      gameState.players.splice(playerIndex, 1);
      delete gameState.scores[socket.id];

      // If player was host, assign new host
      if (wasHost && gameState.players.length > 0) {
        gameState.players[0].isHost = true;
      }

      // Remove room if empty
      if (gameState.players.length === 0) {
        console.log(`Room ${roomCode} is empty, cleaning up`);
        gameRooms.delete(roomCode);
        if (roomTimers.has(roomCode)) {
          clearInterval(roomTimers.get(roomCode));
          roomTimers.delete(roomCode);
        }
      } else {
        // Notify remaining players
        socket.to(roomCode).emit("userLeft", {
          id: socket.id,
          players: gameState.players,
        });

        // If game is in progress and there's only one player left, end the game
        if (gameState.phase === "playing" && gameState.players.length === 1) {
          endGame(roomCode);
        }
      }
    }

    socket.leave(roomCode);
  }

// Function to randomly select a genre
  function getRandomGenre() {
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];

  console.log(`Selected Genre: ${randomGenre}`); 
  return randomGenre; 
  }

  function splitTitleAndArtist(responseText) {
    return responseText.trim()
        .split('\n')  // Split the response by newlines
        .filter(line => line.includes(" - "))  // Only keep lines with ' - ', i.e., song-artist pairs
        .map((line) => {
            // Remove list number (e.g., "1. ") at the start of the line
            const cleanedLine = line.replace(/^\d+\.\s*/, '').replace(/"/g, ''); // Remove numbers and quotes
            const [songTitle, artistName] = cleanedLine.split(' - '); // Split into song and artist
            return { song: songTitle.trim(), artist: artistName.trim() }; // Return an object
        });
  }
  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Function to get a song and artist suggestion from OpenAI based on the genre
  async function getSongAndArtistByGenre(genre, numSongs) {
    try 
    {
        const response = await openai.chat.completions.create({
            messages: [{
                role: "user",
                content: `Suggest ${numSongs} random, unique song and artist pairs from the ${genre} genre. Format each as "Song Title - Artist Name", and separate them by new lines.`
            }],
            // Currently, using GPT-4, might have to experiment with other models
            model: "gpt-4o-mini",
        });
        console.log(`OpenAI API Response: ${response.choices[0].message.content}`);

        return splitTitleAndArtist(response.choices[0].message.content).slice(0, numSongs);

    } 
    catch (error) 
    {
        console.error("[Error]: Unable to generate a song", error);
        return null;
    }
  } 
  httpServer.listen(port, () => {
    const apiUrl =
      process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_API_URL_PROD
        : `http://localhost:${port}`;
    console.log(`> Ready on ${apiUrl}`);
  });
});
