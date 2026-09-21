/**
 * Detección de versión nueva (PLAN §16.2). Consulta `version.json` sin caché al arrancar, al
 * volver a la pestaña y cada `intervalMs`. Si el build remoto difiere del propio, avisa una vez.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface VersionCheckerOptions {
  readonly currentBuildId: string;
  readonly fetch: FetchLike;
  readonly onNewVersion: (remoteBuildId: string) => void;
  readonly url?: string;
  readonly intervalMs?: number;
  readonly now?: () => number;
}

export class VersionChecker {
  private notified = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') void this.check();
  };

  constructor(private readonly options: VersionCheckerOptions) {}

  /** Una verificación. Devuelve el build remoto (o undefined si no se pudo consultar). */
  async check(): Promise<string | undefined> {
    const now = this.options.now?.() ?? Date.now();
    const url = `${this.options.url ?? '/version.json'}?t=${now}`;
    try {
      const res = await this.options.fetch(url, { cache: 'no-store' });
      if (!res.ok) return undefined;
      const body = (await res.json()) as { buildId?: unknown };
      const remote = typeof body.buildId === 'string' ? body.buildId : undefined;
      if (remote && remote !== this.options.currentBuildId && !this.notified) {
        this.notified = true;
        this.options.onNewVersion(remote);
      }
      return remote;
    } catch {
      return undefined; // sin red: se reintenta en la próxima ocasión
    }
  }

  start(): void {
    void this.check();
    this.timer = setInterval(() => void this.check(), this.options.intervalMs ?? 5 * 60_000);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('focus', this.onVisible);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('focus', this.onVisible);
  }
}
