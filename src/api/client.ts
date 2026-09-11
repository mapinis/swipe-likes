import { getValidAccessToken } from "../auth/session.ts";

const API_BASE = "https://api.spotify.com/v1";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

type Fetcher = typeof fetch;
type TokenGetter = () => Promise<string>;

export interface ClientDeps {
  fetchImpl?: Fetcher;
  getToken?: TokenGetter;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class SpotifyClient {
  private readonly fetchImpl: Fetcher;
  private readonly getToken: TokenGetter;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: ClientDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? fetch.bind(globalThis);
    this.getToken = deps.getToken ?? getValidAccessToken;
    this.maxRetries = deps.maxRetries ?? 5;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = path.startsWith("http") ? new URL(path) : new URL(API_BASE + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const hasBody = opts.body !== undefined;

    for (let attempt = 0; ; attempt++) {
      const token = await this.getToken();
      const res = await this.fetchImpl(url, {
        method: opts.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
        },
        body: hasBody ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });

      if (res.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
        await this.sleep((Number.isFinite(retryAfter) ? retryAfter : 1) * 1000);
        continue;
      }

      if ((res.status === 500 || res.status === 502 || res.status === 503) &&
          attempt < this.maxRetries) {
        await this.sleep(Math.min(2 ** attempt * 250, 4000));
        continue;
      }

      if (res.status === 204 || res.status === 202) {
        return undefined as T;
      }

      const text = await res.text();
      const parsed = text ? safeJson(text) : undefined;

      if (!res.ok) {
        const msg =
          (parsed as { error?: { message?: string } } | undefined)?.error
            ?.message ?? res.statusText;
        throw new SpotifyApiError(res.status, msg, parsed);
      }

      return parsed as T;
    }
  }

  /** Follow Spotify's `next` cursor, collecting `items` from every page. */
  async getAllPages<T>(
    path: string,
    query: RequestOptions["query"] = {},
    onProgress?: (collected: number, total: number | null) => void,
    maxPages = Infinity,
  ): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = this.buildUrl(path, { limit: 50, ...query });
    let total: number | null = null;
    let pages = 0;

    while (next && pages < maxPages) {
      const page: Page<T> = await this.request<Page<T>>(next);
      out.push(...page.items);
      total = page.total ?? total;
      onProgress?.(out.length, total);
      next = page.next;
      pages++;
    }
    return out;
  }
}

export interface Page<T> {
  items: T[];
  next: string | null;
  total?: number;
  limit?: number;
  offset?: number;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
