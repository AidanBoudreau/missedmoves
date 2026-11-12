import type { Miss } from './types';

export interface SavedDeck {
  misses: Miss[];
  analyzed: string[];
}

const key = (user: string) => 'missed-moves:' + user;

export function loadDeck(user: string): SavedDeck | null {
  try {
    const raw = localStorage.getItem(key(user));
    return raw ? (JSON.parse(raw) as SavedDeck) : null;
  } catch {
    return null;
  }
}

export function saveDeck(user: string, deck: SavedDeck): void {
  try {
    localStorage.setItem(key(user), JSON.stringify(deck));
  } catch (e) {
    console.warn(e);
  }
}
