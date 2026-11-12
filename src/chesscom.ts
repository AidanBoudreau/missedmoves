import type { ChessComGame, TimeClass } from './types';

export async function fetchGames(user: string, count: number, tc: TimeClass): Promise<ChessComGame[]> {
  let r: Response;
  try {
    r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
  } catch {
    throw new Error("Couldn't reach chess.com. Check your connection and try again.");
  }
  if (r.status === 404) throw new Error(`There's no chess.com player named "${user}". Check the spelling.`);
  if (!r.ok) throw new Error(`chess.com returned an error (${r.status}). Try again in a minute.`);
  const { archives = [] } = (await r.json()) as { archives?: string[] };

  const out: ChessComGame[] = [];
  for (let k = archives.length - 1; k >= 0 && out.length < count; k--) {
    const data = (await (await fetch(archives[k])).json()) as { games?: ChessComGame[] };
    const games = (data.games ?? [])
      .filter((g) => g.rules === 'chess' && g.pgn && (tc === 'all' || g.time_class === tc))
      .sort((a, b) => b.end_time - a.end_time);
    out.push(...games);
  }
  return out.slice(0, count);
}
