import { Chess, type Move, type Square } from 'chess.js';
import { getEngine, type EvalResult } from './engine';

export const DEPTH = 11;

export const GLYPH: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export const fmt = (cp: number): string =>
  cp >= 1000 ? 'a forced mate' : cp <= -1000 ? 'getting mated' : (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);

/** "12. Nf3" or "12... Nf6" for the ply at index i. */
export const label = (i: number, san: string): string => `${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${san}`;

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Play a UCI move ("e7e8q") on the board; returns null instead of throwing if illegal. */
export function playUci(c: Chess, uci: string): Move | null {
  try {
    return c.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] || 'q' });
  } catch {
    return null;
  }
}

export async function evalAt(fen: string, urgent = false): Promise<EvalResult> {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: -1000, best: null };
  if (c.isGameOver()) return { cp: 0, best: null };
  return getEngine().analyze(fen, DEPTH, urgent);
}
