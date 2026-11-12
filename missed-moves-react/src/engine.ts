import stockfishUrl from 'stockfish.js/stockfish.js?url';

export interface EvalResult {
  best: string | null;
  /** Centipawns from the side to move, clamped to ±700; forced mate = ±1000. */
  cp: number;
}

interface Job {
  fen: string;
  depth: number;
  res: (r: EvalResult) => void;
  rej: (e: unknown) => void;
}

type Listener = (line: string) => void;

/** Stockfish running in a Web Worker, with a simple priority queue. */
export class Engine {
  private w: Worker;
  private subs = new Set<Listener>();
  private q: Job[] = [];
  private busy = false;
  readonly ready: Promise<void>;

  constructor() {
    this.w = new Worker(stockfishUrl);
    this.w.onmessage = (e: MessageEvent) => {
      const line = String(e.data);
      this.subs.forEach((f) => f(line));
    };
    const boot = new Promise<void>((res, rej) => {
      this.w.onerror = () => rej(new Error('engine'));
      this.waitFor('uci', 'uciok')
        .then(() => this.waitFor('isready', 'readyok'))
        .then(() => res());
    });
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('engine')), 25000));
    this.ready = Promise.race([boot, timeout]);
  }

  private waitFor(cmd: string, token: string): Promise<string> {
    return new Promise((res) => {
      const f: Listener = (l) => {
        if (l.startsWith(token)) {
          this.subs.delete(f);
          res(l);
        }
      };
      this.subs.add(f);
      this.w.postMessage(cmd);
    });
  }

  /** Queue an analysis. `urgent` jobs jump the queue (used when checking a user's answer). */
  analyze(fen: string, depth: number, urgent = false): Promise<EvalResult> {
    return new Promise((res, rej) => {
      const job: Job = { fen, depth, res, rej };
      if (urgent) this.q.unshift(job);
      else this.q.push(job);
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.busy || !this.q.length) return;
    this.busy = true;
    const job = this.q.shift()!;
    try {
      await this.ready;
      job.res(await this.run(job.fen, job.depth));
    } catch (e) {
      job.rej(e);
    }
    this.busy = false;
    void this.pump();
  }

  private run(fen: string, depth: number): Promise<EvalResult> {
    return new Promise((res) => {
      let cp = 0;
      let mate: number | null = null;
      const f: Listener = (l) => {
        if (l.startsWith('info') && l.includes(' score ')) {
          const m = l.match(/score (cp|mate) (-?\d+)/);
          if (m) {
            if (m[1] === 'cp') {
              cp = +m[2];
              mate = null;
            } else mate = +m[2];
          }
        } else if (l.startsWith('bestmove')) {
          this.subs.delete(f);
          // Clamp: winning by a lot counts as +700, forced mate as +1000.
          const score = mate !== null ? (mate > 0 ? 1000 : -1000) : Math.max(-700, Math.min(700, cp));
          const best = l.split(' ')[1];
          res({ best: best && best !== '(none)' ? best : null, cp: score });
        }
      };
      this.subs.add(f);
      this.w.postMessage('position fen ' + fen);
      this.w.postMessage('go depth ' + depth);
    });
  }

  terminate(): void {
    this.w.terminate();
  }
}

let instance: Engine | null = null;

/** Shared engine, created on first use. */
export function getEngine(): Engine {
  if (!instance) instance = new Engine();
  return instance;
}

/** Drop a broken engine so the next call starts fresh. */
export function resetEngine(): void {
  instance?.terminate();
  instance = null;
}
