const OpenAI = require("openai");
require('dotenv/config');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
const DEFAULT_MAX_ROUNDS = 3;
const NUM_OPTIONS = 4; // Total answer options per round, including 1 correct answer
const RATE_LIMIT_DELAY = 1000; // Delay between requests in milliseconds

// Fixed set of genres
const genres = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Jazz",
  "Classical",
  "Blues",
  "R&B",
  "Soul",
  "Country",
  "Electronic",
  "Reggae",
  "Funk",
  "Disco",
  "Folk",
  "Metal",
  "Punk",
  "Alternative",
  "Indie Rock",
  "K-Pop",
];

const youTubeApiKey = process.env.YOUTUBE_API_KEY;

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

function initializeGameState(roomCode, maxRounds) {
  return {
    roomCode,
    phase: "lobby",
    players: [],
    currentRound: 0,
    maxRounds,
    scores: {},
    currentSong: null,
    songList: [],
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

  // Function to handle new connections and join rooms
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
      gameState = initializeGameState(roomCode, DEFAULT_MAX_ROUNDS);
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

    // Event to fetch a new avatar for the player
    socket.on("fetch_new_avatar", () => {
      const newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`;
      socket.emit("new_avatar", { avatar: newAvatarUrl });
    });

    // Event to refresh avatar specifically for the current player
    socket.on("refresh_avatar", ({ playerId }) => {
      const newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`;
      io.to(playerId).emit("updated_avatar", {
        playerId,
        avatar: newAvatarUrl,
      });
    });

    // Event to allow host to set max rounds
    socket.on("setMaxRounds", ({ roomCode, maxRounds }) => {
      const gameState = gameRooms.get(roomCode);
      if (gameState) {
        gameState.maxRounds = maxRounds;
        console.log(`Max rounds set to ${maxRounds} for room ${roomCode}`);
        io.in(roomCode).emit("maxRoundsUpdated", maxRounds); // Notify players
      }
    });

    // Event to handle the initial game state request
    socket.on("get_initial_game_state", ({ roomCode }) => {
      const gameState = gameRooms.get(roomCode);
      if (gameState) {
        socket.emit("initial_game_state", { maxRounds: gameState.maxRounds });
      }
    });

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
        songId: gameState.currentSong.id,
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
      console.log("User disconnected:", socket.id);
      socketToRoom.delete(socket.id);
      handlePlayerLeaving(socket, roomCode);
    });

    console.log(`Room ${roomCode} updated players:`, gameState.players);
  }

  // Unified endRound function
  function endRound(roomCode) {
    console.log("Ending round for room:", roomCode);
    const gameState = gameRooms.get(roomCode);
    if (!gameState) return;

    // Ensure currentSong is defined
    if (!gameState.currentSong) {
      console.error("currentSong is null or undefined");
      return;
    }

    const correctAnswer = gameState.currentSong.correctAnswer;
    if (!correctAnswer) {
      console.error("correctAnswer is missing in currentSong");
      return;
    }

    // Clear round timer
    if (roomTimers.has(roomCode)) {
      clearInterval(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    // Send round results to all players
    io.in(roomCode).emit("round_end", {
      correctAnswer: correctAnswer,
      scores: gameState.scores,
      answers: Array.from(gameState.answers.entries()).map(
        ([playerId, data]) => ({
          player: gameState.players.find((p) => p.id === playerId),
          ...data,
        })
      ),
    });

    // Check if game should end
    if (gameState.currentRound >= gameState.maxRounds) {
      console.log(
        `Maximum rounds (${gameState.maxRounds}) reached, ending game`
      );
      endGame(roomCode);
      return;
    }

    // Start next round after delay
    console.log(`Starting next round in 5 seconds for room ${roomCode}`);
    setTimeout(() => {
      if (verifyGameState(roomCode)) {
        startNewRound(roomCode);
      }
    }, 5000);
  }

  // Unified handlePlayerLeaving function
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

  // Function to handle game start
  async function startGame(roomCode) {
    console.log(`Starting game in room ${roomCode}`);
    const gameState = gameRooms.get(roomCode);

    if (!gameState || gameState.phase !== "lobby") {
      console.log("Cannot start game - invalid game state");
      return;
    }

    const hostPlayer = gameState.players.find((p) => p.isHost);
    if (hostPlayer?.id !== hostPlayer.id) { // Assuming hostPlayer.id === socket.id
      console.log("Cannot start game - not host");
      return;
    }

    /**
     * *** OpenAI API Integration ***
     * Fetch random songs when the game starts.
     */
    const rounds = []; // Store each round's data
    for (let i = 0; i < gameState.maxRounds; i++) {
      const selectedGenre = getRandomGenre();
      const songSuggestions = await getSongAndArtistByGenre(
        selectedGenre,
        NUM_OPTIONS
      );

      console.log("Song Suggestions:", songSuggestions);

      // Skip round if there was an error or not enough suggestions returned
      if (!songSuggestions || songSuggestions.length < NUM_OPTIONS) continue;

      // First suggestion is the correct answer; others are incorrect answers
      const correctAnswer = songSuggestions[0];
      const incorrectAnswers = songSuggestions.slice(1);
      console.log("incorrectAnswers", incorrectAnswers);

      // Store the round data in the specified format
      rounds.push({
        genre: selectedGenre,
        correctAnswer,
        incorrectAnswers,
      });
      // Introduce a delay after each round (before the next API call)
      await delay(RATE_LIMIT_DELAY);
    }
    console.log("All Rounds Data:", JSON.stringify(rounds, null, 2));

    if (!rounds || rounds.length !== gameState.maxRounds) {
      console.log(
        "Failed to fetch the required number of rounds from OpenAI"
      );
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
  }

  // Function to start a new round
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
    if (gameState.currentRound > gameState.maxRounds) {
      endGame(roomCode);
      return;
    }

    // Retrieve the current round's song data
    const roundData = gameState.songList[gameState.currentRound - 1];
    if (!roundData) {
      console.error("Round data is missing");
      endGame(roomCode);
      return;
    }

    const correctSong = roundData.correctAnswer; // { song: string, artist: string }
    let currentSongId;
    try {
      currentSongId = await getYouTubeId(correctSong.song, correctSong.artist);
    } catch (error) {
      console.error(
        "Error fetching YouTube ID for the current song:",
        error.message
      );
      return; // Exit in this case
    }

    if (!correctSong || !currentSongId) {
      console.error(
        "No song found for this round or no song ID found from YouTube"
      );
      return; // Exit in this case
    }

    // Construct the Song object
    const songObject = {
      id: currentSongId,
      previewUrl: `https://www.youtube.com/watch?v=${currentSongId}`,
      title: correctSong.song,
      artist: correctSong.artist,
      options: shuffleArray([
        correctSong.song,
        ...roundData.incorrectAnswers.map(ans => ans.song)
      ]),
      correctAnswer: correctSong.song,
    };

    // Assign to gameState.currentSong
    gameState.currentSong = songObject;

    // Broadcast to ALL players in the room
    io.in(roomCode).emit("new_round", {
      roundNumber: gameState.currentRound,
      maxRounds: gameState.maxRounds,
      song: songObject,
      songId: currentSongId,
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

  // Function to end the game
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

  // Function to verify game state
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

  // Socket.io connection handler
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
            songId: gameState.currentSong.id,
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
      await startGame(roomCode);
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
  });

  // Function to end the game
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

  // Function to start a new round
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
    if (gameState.currentRound > gameState.maxRounds) {
      endGame(roomCode);
      return;
    }

    // Retrieve the current round's song data
    const roundData = gameState.songList[gameState.currentRound - 1];
    if (!roundData) {
      console.error("Round data is missing");
      endGame(roomCode);
      return;
    }

    const correctSong = roundData.correctAnswer; // { song: string, artist: string }
    let currentSongId;
    try {
      currentSongId = await getYouTubeId(correctSong.song, correctSong.artist);
    } catch (error) {
      console.error(
        "Error fetching YouTube ID for the current song:",
        error.message
      );
      return; // Exit in this case
    }

    if (!correctSong || !currentSongId) {
      console.error(
        "No song found for this round or no song ID found from YouTube"
      );
      return; // Exit in this case
    }

    // Construct the Song object
    const songObject = {
      id: currentSongId,
      previewUrl: `https://www.youtube.com/watch?v=${currentSongId}`,
      title: correctSong.song,
      artist: correctSong.artist,
      options: shuffleArray([
        correctSong.song,
        ...roundData.incorrectAnswers.map(ans => ans.song)
      ]),
      correctAnswer: correctSong.song,
    };

    // Assign to gameState.currentSong
    gameState.currentSong = songObject;

    // Broadcast to ALL players in the room
    io.in(roomCode).emit("new_round", {
      roundNumber: gameState.currentRound,
      maxRounds: gameState.maxRounds,
      song: songObject,
      songId: currentSongId,
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

  /**
   * This function is responsible for sending a GET request to the YouTube API
   * for the given track title and artist and returns the video ID
   */
  async function getYouTubeId(song, artist) {
    try {
      const query = `${song} ${artist}`; // Query string to search YouTube

      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet", // Request snippet info
            q: query, // Search query
            type: "video",
            key: youTubeApiKey, // API Key from .env
          },
        }
      );

      if (response.data.items && response.data.items.length > 0) {
        const videoID = response.data.items[0].id.videoId; // Extract the first match
        return videoID; // Return the video ID
      } else {
        throw new Error(
          "Error: Could not return video for the given song and artist"
        );
      }
    } catch (error) {
      console.error("Could not fetch YouTube video Error:", error.message);
      throw error;
    }
  }

  // Function to randomly select a genre
  function getRandomGenre() {
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];

    console.log(`Selected Genre: ${randomGenre}`);
    return randomGenre;
  }

  function splitTitleAndArtist(responseText) {
    return responseText
      .trim()
      .split("\n") // Split the response by newlines
      .filter((line) => line.includes(" - ")) // Only keep lines with ' - ', i.e., song-artist pairs
      .map((line) => {
        // Remove list number (e.g., "1. ") at the start of the line
        const cleanedLine = line.replace(/^\d+\.\s*/, "").replace(/"/g, ""); // Remove numbers and quotes
        const [songTitle, artistName] = cleanedLine.split(" - "); // Split into song and artist
        return { song: songTitle.trim(), artist: artistName.trim() }; // Return an object
      });
  }

  async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Function to get song and artist suggestions from OpenAI based on the genre
  async function getSongAndArtistByGenre(genre, numSongs) {
    try {
      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Suggest ${numSongs} random, unique song and artist pairs from the ${genre} genre. Format each as "Song Title - Artist Name", and separate them by new lines.`,
          },
        ],
        // Currently, using GPT-4, might have to experiment with other models
        model: "gpt-4",
      });
      console.log(
        `OpenAI API Response: ${response.choices[0].message.content}`
      );

      return splitTitleAndArtist(response.choices[0].message.content).slice(
        0,
        numSongs
      );
    } catch (error) {
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