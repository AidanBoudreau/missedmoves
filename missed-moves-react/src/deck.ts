import { shuffle } from './chessUtils';
import type { Miss } from './types';

export interface DeckState {
  misses: Miss[];
  /** Card order, by miss id. */
  queue: string[];
  /** Index into queue of the current card, -1 when nothing is showing. */
  idx: number;
  /** Bumped every time a card is (re)shown, so the trainer can reset. */
  visit: number;
}

export type DeckAction =
  | { type: 'load'; misses: Miss[] }
  | { type: 'add'; miss: Miss }
  | { type: 'next' }
  | { type: 'result'; id: string; solved: boolean };

export const emptyDeck: DeckState = { misses: [], queue: [], idx: -1, visit: 0 };

/** Unsolved cards first, each group shuffled. */
const order = (misses: Miss[]) =>
  [...shuffle(misses.filter((m) => !m.solved)), ...shuffle(misses.filter((m) => m.solved))].map((m) => m.id);

export function deckReducer(s: DeckState, a: DeckAction): DeckState {
  switch (a.type) {
    case 'load': {
      const queue = order(a.misses);
      return { misses: a.misses, queue, idx: queue.length ? 0 : -1, visit: s.visit + 1 };
    }
    case 'add': {
      if (s.misses.some((x) => x.id === a.miss.id)) return s;
      // Drop the new card somewhere after the current one.
      const at = s.idx + 1 + Math.floor(Math.random() * (s.queue.length - s.idx));
      const queue = [...s.queue];
      queue.splice(Math.max(s.idx + 1, at), 0, a.miss.id);
      const misses = [...s.misses, a.miss];
      if (s.idx < 0) return { misses, queue, idx: 0, visit: s.visit + 1 };
      return { ...s, misses, queue };
    }
    case 'next': {
      if (!s.queue.length) return s;
      const idx = (s.idx + 1) % s.queue.length;
      // Finished a pass: unsolved cards first next time.
      const queue = idx === 0 && s.idx >= 0 ? order(s.misses) : s.queue;
      return { ...s, queue, idx, visit: s.visit + 1 };
    }
    case 'result':
      return {
        ...s,
        misses: s.misses.map((m) => (m.id === a.id ? { ...m, solved: a.solved, seen: m.seen + 1 } : m)),
      };
  }
}

export const currentMiss = (s: DeckState): Miss | null => {
  const id = s.idx >= 0 ? s.queue[s.idx] : undefined;
  return id ? (s.misses.find((m) => m.id === id) ?? null) : null;
};
