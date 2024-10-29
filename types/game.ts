// Universal types for the game to use in other files via import
export interface BasePlayer {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
    score?: number;
  }
  
  export interface GamePlayer extends BasePlayer {
    finalScore: number;
  }
  
  export type GamePhase = "lobby" | "playing" | "gameOver";
  
  export interface GameState {
    phase: GamePhase;
    currentRound: number;
    timeLeft: number;
    scores: Record<string, number>;
    finalStandings?: GamePlayer[];
  }

  export type VariantType = "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | "success" | null | undefined;