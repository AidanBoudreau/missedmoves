export type Color = 'w' | 'b';
export type TimeClass = 'all' | 'rapid' | 'blitz' | 'bullet' | 'daily';
export type Sensitivity = 'big' | 'normal' | 'more';

export interface MoveRef {
  from: string;
  to: string;
  text?: string;
}

/** One flashcard: a position where the player had a winning shot and missed it. */
export interface Miss {
  id: string;
  fen: string;
  color: Color;
  /** Engine's best move in UCI notation, e.g. "e2e4" or "e7e8q". */
  best: string;
  bestSan: string;
  /** Eval before the move (centipawns, clamped; ±1000 = mate). */
  cp: number;
  /** Eval after the move actually played. */
  gotCp: number;
  playedSan: string;
  prev: MoveRef | null;
  url: string;
  opp: string;
  tc: string;
  date: number;
  solved: boolean;
  seen: number;
}

export interface ChessComGame {
  url: string;
  pgn?: string;
  rules: string;
  time_class: string;
  end_time: number;
  white: { username: string };
  black: { username: string };
}
