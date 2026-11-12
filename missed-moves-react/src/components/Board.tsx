import { useEffect, useMemo, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { GLYPH } from '../chessUtils';
import type { MoveRef } from '../types';

interface Props {
  fen: string;
  /** Show the board from Black's side. */
  flip: boolean;
  sel: Square | null;
  last: MoveRef | null;
  okSq: string[] | null;
  hintSq: string | null;
  /** Increment to play the "wrong move" shake. */
  shake: number;
  onTap: (sq: Square) => void;
}

const FILES = 'abcdefgh';

export function Board({ fen, flip, sel, last, okSq, hintSq, shake, onTap }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const targets = useMemo(() => (sel ? chess.moves({ square: sel, verbose: true }) : []), [chess, sel]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !shake) return;
    el.classList.remove('shake');
    void el.offsetWidth; // restart the animation
    el.classList.add('shake');
  }, [shake]);

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const file = FILES[flip ? 7 - f : f];
      const rank = flip ? r + 1 : 8 - r;
      const sq = (file + rank) as Square;
      const fi = FILES.indexOf(file);
      const p = chess.get(sq);
      const t = targets.find((x) => x.to === sq);

      const cls = ['sq'];
      if ((fi + rank) % 2 === 1) cls.push('d');
      if (last && (sq === last.from || sq === last.to)) cls.push('last');
      if (okSq?.includes(sq)) cls.push('ok');
      if (sq === sel) cls.push('sel');
      if (sq === hintSq) cls.push('hint');
      if (t) cls.push('dot', ...(t.captured ? ['cap'] : []));

      squares.push(
        <button
          key={sq}
          type="button"
          className={cls.join(' ')}
          aria-label={sq + (p ? ` ${p.color === 'w' ? 'white' : 'black'} ${p.type}` : '')}
          onClick={() => onTap(sq)}
        >
          {p && <span className={'pc ' + p.color}>{GLYPH[p.type] + '︎'}</span>}
          {r === 7 && <span className="coord f">{file}</span>}
          {f === 0 && <span className="coord r">{rank}</span>}
        </button>,
      );
    }
  }

  return (
    <div className="board" ref={ref} role="grid" aria-label="Chess board">
      {squares}
    </div>
  );
}
