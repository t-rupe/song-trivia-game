const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const axios = require("axios"); // For making HTTP requests to APIs

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
    songList: [], // **Added to store songs fetched from OpenAI**
  };
}

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_API_URL_PROD
          : "http://localhost:3001",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  /**
   * *** OpenAI API Integration ***
   * When the game starts, fetch a list of random song names and artists using the OpenAI API.
   * The number of songs fetched should match the MAX_ROUNDS.
   */
  async function fetchRandomSongsFromOpenAI(numberOfSongs) {
    // TODO: Shubhank to implement OpenAI API call here
    // Example steps:
    // 1. Set up OpenAI API credentials securely using environment variables (.env file).
    // 2. Create a prompt that instructs OpenAI to generate random song names and artists.
    // 3. Make a request to OpenAI's API with the prompt as per their docs https://platform.openai.com/docs/libraries/node-js-library.
    // 4. Parse and return the generated song data.

    // Example Placeholder Response
    return [
      { title: "Echoes of Time", artist: "Luna Harmony" },
      { title: "Starlight Serenade", artist: "Nova Beats" },
      { title: "Midnight Mirage", artist: "Solar Pulse" },
    ];
  }

  /**
   * *** Spotify API Integration ***
   * Fetch a random song snippet from Spotify API.
   * This function should interact with Spotify's API to retrieve song data.
   */
  async function fetchRandomSongFromSpotify() {
    // TODO: Elissa to implement Spotify API call here
    // Example steps:
    // 1. Authenticate with Spotify using Client Credentials Flow.
    // 2. Fetch a list of tracks based on the received song names/artists from OpenAI
    // 3. Select a random track from the fetched list.
    // 4. Return necessary song data (id, preview_url, name, artists).

    // Example Placeholder Response
    return {
      id: "123456",
      preview_url: "https://p.scdn.co/mp3-preview/example.mp3",
    };
  }

  /**
   * *** OpenAI API Integration ***
   * Generates multiple choice options for the song.
   * This ensures that each round has plausible distractors.
   */
  async function generateOptions(correctTitle) {
    // TODO: Shubhank to implement logic to generate distractor song titles
    // Possible approach:
    // 1. Use the OpenAI API to generate similar or plausible song titles.
    // 2. Ensure no duplicates and include the correct title.
    // 3. Shuffle the options before returning.

    // Example Placeholder Options
    const options = [
      correctTitle,
      "Whispers in the Wind",
      "Shadows of the Night",
      "Dreamscape Symphony",
    ];
    return shuffleArray(options);
  }

  /**
   * *** startNewRound Function ***
   * Initiates a new round by selecting a song and broadcasting it to all players.
   */
  async function startNewRound(roomCode) {
    console.log("Starting new round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) {
      console.log("Cannot start round - game state not found");
      return;
    }

    gameState.currentRound++;
    console.log(`Round ${gameState.currentRound} starting for room ${roomCode}`);

    // Clear previous round data
    gameState.answers.clear();
    gameState.roundTimeLeft = ROUND_TIME;
    gameState.roundStartTime = Date.now();

    // Check if game should end
    if (gameState.currentRound > MAX_ROUNDS) {
      endGame(roomCode);
      return;
    }

    // *** ELISSA: Integrate Spotify API here to fetch a song snippet ***
    // Replace mockSong with songData obtained from Spotify
    // Since OpenAI is deciding which song to play, use the songList from OpenAI for the current round
    const songList = gameState.songList;
    if (gameState.currentRound > songList.length) {
      console.log("Insufficient songs fetched from OpenAI");
      endGame(roomCode);
      return;
    }

    const currentSongInfo = songList[gameState.currentRound - 1];

    const songData = await fetchRandomSongFromSpotify(); // Elissa to implement this function

    if (!songData) {
      console.log("Failed to fetch song data from Spotify");
      // Handle error, possibly end the game or retry
      return;
    }

    const formattedSong = {
      id: songData.id,
      previewUrl: songData.preview_url, // Ensure this field exists
      title: currentSongInfo.title, // Use title from OpenAI
      artist: currentSongInfo.artist, // Use artist from OpenAI
      correctAnswer: currentSongInfo.title,
      options: await generateOptions(currentSongInfo.title), // Elissa to implement generateOptions if needed
    };

    gameState.currentSong = formattedSong;

    console.log(`Broadcasting round ${gameState.currentRound} to all players in room ${roomCode}`, {
      songData: formattedSong,
      playerCount: gameState.players.length,
    });

    /*** End of Spotify API Integration ***/

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
      song: formattedSong,
    });

    // Start the timer for this round
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    const timer = setInterval(() => {
      if (!gameState || !gameState.roundTimeLeft || gameState.roundTimeLeft <= 0) {
        clearInterval(timer);
        endRound(roomCode);
        return;
      }

      gameState.roundTimeLeft--;
      io.in(roomCode).emit("time_update", gameState.roundTimeLeft);
    }, 1000);

    roomTimers.set(roomCode, timer);
  }

  /**
   * *** endRound Function ***
   * Handles the end of a round by calculating scores and determining if the game should end.
   */
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
      answers: Array.from(gameState.answers.entries()).map(([playerId, data]) => ({
        player: gameState.players.find((p) => p.id === playerId),
        ...data,
      })),
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

  /**
   * *** endGame Function ***
   * Handles the end of the game by calculating final standings and notifying all players.
   */
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

    // Keep the game state intact for the game over screen
    gameState.currentSong = null;
    gameState.answers.clear();
  }

  /**
   * *** verifyGameState Function ***
   * Ensures that the game state is consistent and all players are still connected.
   */
  function verifyGameState(io, roomCode) {
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return false;

    // Verify all players are still connected
    const connectedPlayers = Array.from(io.sockets.adapter.rooms.get(roomCode) || []);
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

  /**
   * *** handlePlayerLeaving Function ***
   * Manages player disconnections and updates the game state accordingly.
   */
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

  /**
   * *** Socket.IO Event Handlers ***
   * Manages real-time communication with clients.
   */
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    /**
     * *** joinRoom Event ***
     * Handles players joining a room.
     */
    socket.on("joinRoom", (roomCode) => {
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

      console.log(`Room ${roomCode} updated players:`, gameState.players);
    });

    /**
     * *** startGame Event ***
     * Initiates the game by fetching songs from OpenAI and starting the first round.
     */
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
      console.log("Fetching random songs from OpenAI for the game");
      const songs = await fetchRandomSongsFromOpenAI(MAX_ROUNDS);

      if (!songs || songs.length !== MAX_ROUNDS) {
        console.log("Failed to fetch the required number of songs from OpenAI");
        // Handle error, possibly notify players and end the game
        io.in(roomCode).emit("error", {
          message: "Failed to fetch songs. Please try again later.",
        });
        cleanupRoom(roomCode);
        return;
      }

      gameState.songList = songs; // Store the fetched songs in game state
      console.log("Fetched songs from OpenAI:", songs);

      // Update game state
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

    /**
     * *** submit_answer Event ***
     * Handles players submitting their answers.
     */
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

    /**
     * *** playAgain Event ***
     * Allows players to reset the game and play again.
     */
    socket.on("playAgain", (roomCode) => {
      console.log(`Play again requested for room ${roomCode}`);
      const gameState = gameRooms.get(roomCode);
      if (!gameState) return;

      gameState.phase = "lobby";
      gameState.currentRound = 0;
      gameState.scores = {};
      gameState.finalStandings = null;
      gameState.songList = []; // Clear previous song list
      gameState.currentSong = null;
      gameState.answers.clear();
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

    /**
     * *** leaveRoom Event ***
     * Handles players leaving a room.
     */
    socket.on("leaveRoom", (roomCode) => {
      console.log(`Player ${socket.id} leaving room ${roomCode}`);
      handlePlayerLeaving(socket, roomCode);
    });

    /**
     * *** disconnecting Event ***
     * Handles players disconnecting from the server.
     */
    socket.on("disconnecting", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (roomCode) {
        handlePlayerLeaving(socket, roomCode);
      }
    });

    /**
     * *** disconnect Event ***
     * Final cleanup when a player disconnects.
     */
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      socketToRoom.delete(socket.id);
    });
  });

  /**
   * *** Placeholder Functions for Spotify and OpenAI Integration ***
   * These functions are placeholders and need to be implemented by Elissa and Shubhank, respectively
   */

  /**
   * Fetches a random song from Spotify API.
   * @returns {Promise<Object>} Song data object
   */
  async function fetchRandomSongFromSpotify() {
    // TODO: Elissa to implement Spotify API call here
    // Example steps:
    // 1. Authenticate with Spotify API using Client Credentials Flow.
    // 2. Fetch a list of tracks based on certain criteria (genre, popularity, etc.).
    // 3. Select a random track from the fetched list.
    // 4. Return necessary song data (id, preview_url, name, artists).

    // Example Placeholder Response
    return {
      id: "123456",
      preview_url: "https://p.scdn.co/mp3-preview/example.mp3",
    };
  }

  /**
   * Generates multiple choice options for the song.
   * @param {string} correctTitle - The correct song title
   * @returns {Promise<Array<string>>} Array of song titles including the correct one and distractors
   */
  async function generateOptions(correctTitle) {
    // TODO: Shubhank to implement logic to generate distractor song titles (the incorrect options meant to confuse players)
    // Possible approach:
    // 1. Use the OpenAI API to generate similar or plausible song titles.
    // 2. Ensure no duplicates and include the correct title.
    // 3. Shuffle the options before returning.

    // Example Placeholder Options
    const options = [
      correctTitle,
      "Whispers in the Wind",
      "Shadows of the Night",
      "Dreamscape Symphony",
    ];
    return shuffleArray(options);
  }

  httpServer.listen(port, () => {
    const apiUrl =
      process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_API_URL_PROD
        : `http://localhost:${port}`;
    console.log(`> Ready on ${apiUrl}`);
  });
});
