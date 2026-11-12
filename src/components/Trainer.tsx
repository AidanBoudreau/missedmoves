import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { Board } from './Board';
import { evalAt, fmt, playUci } from '../chessUtils';
import type { Miss, MoveRef } from '../types';

interface Props {
  miss: Miss;
  deckInfo: string;
  /** Called once per card; `solved` is true only for a first-try solve. */
  onResult: (solved: boolean) => void;
  onNext: () => void;
}

type Kind = '' | 'good' | 'bad';

/** One flashcard. The parent remounts it (via `key`) each time a card is shown. */
export function Trainer({ miss, deckInfo, onResult, onNext }: Props) {
  const [fen, setFen] = useState(miss.fen);
  const [sel, setSel] = useState<Square | null>(null);
  const [last, setLast] = useState<MoveRef | null>(miss.prev);
  const [okSq, setOkSq] = useState<string[] | null>(null);
  const [hint, setHint] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [solvedFirst, setSolvedFirst] = useState(false);
  const [shake, setShake] = useState(0);
  const [fb, setFb] = useState<{ text: string; kind: Kind }>({
    text: `Your move gave ${fmt(miss.gotCp)}. The best move keeps ${fmt(miss.cp)}.`,
    kind: '',
  });

  const tries = useRef(0);
  const doneRef = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const side = miss.color === 'w' ? 'White' : 'Black';
  const prompt = miss.prev
    ? `You're ${side}. After ${miss.prev.text}, you played ${miss.playedSan}. Find the stronger move.`
    : `You're ${side}. You played ${miss.playedSan}. Find the stronger move.`;

  function finish(solved: boolean, msg: string, mv: MoveRef) {
    doneRef.current = true;
    const first = solved && tries.current === 1;
    setDone(true);
    setSolvedFirst(first);
    setOkSq([mv.from, mv.to]);
    setFb({
      text: msg + (solved && tries.current > 1 ? ' Solved on a later try, so it stays in the deck.' : ''),
      kind: solved ? 'good' : 'bad',
    });
    onResult(first);
  }

  async function attempt(mv: Move) {
    tries.current++;
    setSel(null);
    const test = new Chess(miss.fen);
    test.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    setFen(test.fen());
    setLast({ from: mv.from, to: mv.to });

    if (mv.from + mv.to === miss.best.slice(0, 4)) {
      return finish(true, `Correct. ${miss.bestSan} was the move.`, mv);
    }

    setChecking(true);
    setFb({ text: 'Checking that move…', kind: '' });
    let cp: number;
    try {
      cp = -(await evalAt(test.fen(), true)).cp;
    } catch {
      cp = -9999;
    }
    if (!alive.current) return;
    setChecking(false);

    if (cp >= miss.cp - 60 && cp >= 150) {
      return finish(true, `That works too (${fmt(cp)}). The engine's first choice was ${miss.bestSan}.`, mv);
    }

    setFb({ text: `Not that one. It gives ${fmt(cp)}, but this position has ${fmt(miss.cp)}. Try again.`, kind: 'bad' });
    setShake((n) => n + 1);
    timer.current = window.setTimeout(() => {
      if (doneRef.current) return;
      setFen(miss.fen);
      setLast(miss.prev);
    }, 700);
  }

  function tap(sq: Square) {
    if (done || checking) return;
    if (sel) {
      const mv = chess
        .moves({ square: sel, verbose: true })
        .find((x) => x.to === sq && (!x.promotion || x.promotion === 'q'));
      if (mv) return void attempt(mv);
    }
    const p = chess.get(sq);
    setSel(p && p.color === chess.turn() && sel !== sq ? sq : null);
  }

  function showHint() {
    setHint(true);
    setSel(null);
    setFb({ text: 'The highlighted piece is the one to move.', kind: '' });
  }

  function reveal() {
    window.clearTimeout(timer.current);
    tries.current = 99;
    const c = new Chess(miss.fen);
    playUci(c, miss.best);
    const mv = { from: miss.best.slice(0, 2), to: miss.best.slice(2, 4) };
    setFen(c.fen());
    setLast(mv);
    setSel(null);
    finish(false, `The move was ${miss.bestSan} (${fmt(miss.cp)}). It stays in the deck.`, mv);
  }

  return (
    <>
      <Board
        fen={fen}
        flip={miss.color === 'b'}
        sel={sel}
        last={last}
        okSq={okSq}
        hintSq={hint && !done ? miss.best.slice(0, 2) : null}
        shake={shake}
        onTap={tap}
      />
      <section className={'card' + (solvedFirst ? ' solved' : '')}>
        <p className="prompt">{prompt}</p>
        <p className={'feedback ' + fb.kind}>{fb.text}</p>
        <div className="actions">
          <button type="button" onClick={showHint} disabled={done || checking}>Hint</button>
          <button type="button" onClick={reveal} disabled={done || checking}>Show answer</button>
          <button type="button" className="primary" onClick={onNext}>Next</button>
        </div>
        <div className="meta">
          <span>{deckInfo}</span>
          <a href={miss.url} target="_blank" rel="noopener">Open game</a>
        </div>
      </section>
    </>
  );
}
