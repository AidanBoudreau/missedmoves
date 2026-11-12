import { Chess } from 'chess.js';
import { evalAt, label, playUci } from './chessUtils';
import type { ChessComGame, Miss, Sensitivity } from './types';

export const SENS: Record<Sensitivity, { min: number; loss: number }> = {
  big: { min: 300, loss: 300 },
  normal: { min: 150, loss: 200 },
  more: { min: 100, loss: 120 },
};

interface Hooks {
  shouldStop: () => boolean;
  onMiss: (m: Miss) => void;
}

/** Walk one game and report every position where `user` was clearly better but played a much worse move. */
export async function analyzeGame(g: ChessComGame, user: string, sens: Sensitivity, hooks: Hooks): Promise<void> {
  const { min, loss } = SENS[sens];
  const color = g.white.username.toLowerCase() === user ? 'w' : 'b';
  const opp = color === 'w' ? g.black.username : g.white.username;

  const c = new Chess();
  try {
    c.loadPgn(g.pgn ?? '', { strict: false });
  } catch {
    return;
  }
  const moves = c.history({ verbose: true });
  const fens = [moves.length ? moves[0].before : c.fen(), ...moves.map((m) => m.after)];

  for (let i = 8; i < moves.length; i++) { // skip the first few opening moves
    if (hooks.shouldStop()) return;
    const m = moves[i];
    if (m.color !== color) continue;

    const before = await evalAt(fens[i]);
    if (!before.best || before.cp < min) continue; // only positions where you were clearly better
    const played = m.from + m.to + (m.promotion ?? '');
    if (before.best.slice(0, 4) === played.slice(0, 4)) continue;

    const after = await evalAt(fens[i + 1]);
    const got = -after.cp;
    if (before.cp - got < loss) continue;

    const bm = playUci(new Chess(fens[i]), before.best);
    hooks.onMiss({
      id: g.url + '#' + i,
      fen: fens[i],
      color,
      best: before.best,
      bestSan: bm ? bm.san : before.best,
      cp: before.cp,
      gotCp: got,
      playedSan: label(i, m.san),
      prev: i > 0 ? { from: moves[i - 1].from, to: moves[i - 1].to, text: label(i - 1, moves[i - 1].san) } : null,
      url: g.url,
      opp,
      tc: g.time_class,
      date: g.end_time * 1000,
      solved: false,
      seen: 0,
    });
  }
}
