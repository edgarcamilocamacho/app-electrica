/**
 * Reloj de pared inyectable (PLAN §10.3). El motor de simulación nunca lo lee: la UI lo usa para
 * decidir hasta qué tiempo de simulación avanzar. En E2E se usa un reloj manual.
 */
export interface Clock {
  now(): number;
}

export const realClock: Clock = { now: () => performance.now() };

export class ManualClock implements Clock {
  private t = 0;

  now(): number {
    return this.t;
  }

  advance(ms: number): void {
    this.t += ms;
  }
}
