import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Chess } from 'chess.js';
import { Board } from './components/Board';
import { Trainer } from './components/Trainer';
import { analyzeGame } from './analysis';
import { fetchGames } from './chesscom';
import { currentMiss, deckReducer, emptyDeck } from './deck';
import { getEngine, resetEngine } from './engine';
import { loadDeck, saveDeck } from './storage';
import type { Sensitivity, TimeClass } from './types';

const START_FEN = new Chess().fen();

export default function App() {
  const [deck, dispatch] = useReducer(deckReducer, emptyDeck);
  const [input, setInput] = useState('');
  const [count, setCount] = useState(25);
  const [tc, setTc] = useState<TimeClass>('all');
  const [sens, setSens] = useState<Sensitivity>('normal');
  const [running, setRunning] = useState(false);
  const [status, setStatusState] = useState({
    text: 'Analysis runs in your browser with Stockfish. Expect around 20 to 40 seconds per game.',
    frac: 0,
  });

  const userRef = useRef<string | null>(null);
  const analyzed = useRef(new Set<string>());
  const stop = useRef(false);
  const deckRef = useRef(deck);
  const inputRef = useRef<HTMLInputElement>(null);

  const setStatus = (text: string, frac?: number | null) =>
    setStatusState((s) => ({ text, frac: frac ?? s.frac }));

  const save = () => {
    if (userRef.current) {
      saveDeck(userRef.current, { misses: deckRef.current.misses, analyzed: [...analyzed.current] });
    }
  };

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  // Persist whenever cards are added or results recorded.
  useEffect(save, [deck.misses]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (running) {
      stop.current = true;
      setStatus('Stopping after this position…');
      return;
    }
    const user = input.trim().toLowerCase();
    if (!user) {
      inputRef.current?.focus();
      return;
    }

    let found = deckRef.current.misses.length;
    if (user !== userRef.current) {
      userRef.current = user;
      const saved = loadDeck(user);
      analyzed.current = new Set(saved?.analyzed ?? []);
      found = saved?.misses.length ?? 0;
      dispatch({ type: 'load', misses: saved?.misses ?? [] });
    }

    setRunning(true);
    stop.current = false;
    try {
      setStatus('Starting the engine…', 0);
      try {
        await getEngine().ready;
      } catch {
        resetEngine();
        throw new Error("The chess engine couldn't start. Try reloading the page in Chrome, Safari or Firefox.");
      }

      setStatus('Fetching games from chess.com…', 0);
      const games = await fetchGames(user, count, tc);
      if (!games.length) throw new Error('No standard games found for that player and time control.');
      const todo = games.filter((g) => !analyzed.current.has(g.url));

      for (let i = 0; i < todo.length && !stop.current; i++) {
        setStatus(`Analyzing game ${i + 1} of ${todo.length}. ${found} misses found so far.`, i / todo.length);
        await analyzeGame(todo[i], user, sens, {
          shouldStop: () => stop.current,
          onMiss: (miss) => {
            if (deckRef.current.misses.some((m) => m.id === miss.id)) return;
            found++;
            dispatch({ type: 'add', miss });
            setStatus(`Analyzing game ${i + 1} of ${todo.length}. ${found} misses found so far.`);
          },
        });
        if (!stop.current) {
          analyzed.current.add(todo[i].url);
          save();
        }
      }

      if (stop.current) setStatus(`Stopped. ${found} misses saved. Press Find misses again to continue.`);
      else if (!found) setStatus('No misses found in these games. Try more games or "Include smaller ones".', 1);
      else setStatus(`Done. ${found} misses across your last ${games.length} games.`, 1);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), 0);
    } finally {
      setRunning(false);
    }
  }

  const miss = currentMiss(deck);
  let deckInfo = '';
  if (miss) {
    const solved = deck.misses.filter((m) => m.solved).length;
    const d = new Date(miss.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    deckInfo = `Card ${deck.idx + 1} of ${deck.queue.length}, ${solved} solved. vs ${miss.opp}, ${miss.tc}, ${d}`;
  }

  return (
    <main>
      <h1>Missed moves</h1>
      <p className="sub">Every position where you had a winning shot and didn't take it, turned into flashcards.</p>

      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="chess.com username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="chess.com username"
        />
        <button className="primary" type="submit">{running ? 'Stop' : 'Find misses'}</button>
      </form>

      <details>
        <summary>Options</summary>
        <label>
          Games to scan
          <select value={count} onChange={(e) => setCount(+e.target.value)}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Time control
          <select value={tc} onChange={(e) => setTc(e.target.value as TimeClass)}>
            <option value="all">All</option>
            <option value="rapid">Rapid</option>
            <option value="blitz">Blitz</option>
            <option value="bullet">Bullet</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <label>
          What counts as a miss
          <select value={sens} onChange={(e) => setSens(e.target.value as Sensitivity)}>
            <option value="big">Only big swings</option>
            <option value="normal">Normal</option>
            <option value="more">Include smaller ones</option>
          </select>
        </label>
      </details>

      <div className="status" aria-live="polite">
        {status.text}
        <div className="bar"><i style={{ width: status.frac * 100 + '%' }} /></div>
      </div>

      {miss ? (
        <Trainer
          key={deck.visit}
          miss={miss}
          deckInfo={deckInfo}
          onResult={(solved) => dispatch({ type: 'result', id: miss.id, solved })}
          onNext={() => dispatch({ type: 'next' })}
        />
      ) : (
        <Board fen={START_FEN} flip={false} sel={null} last={null} okSq={null} hintSq={null} shake={0} onTap={() => {}} />
      )}
    </main>
  );
}
