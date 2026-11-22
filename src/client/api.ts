// src/client/api.ts: thin fetch wrappers for the §8 HTTP contract. Takes a `getAccessToken`
// function injected in (NOT importing auth.ts directly) — only auth.ts itself talks to GoTrue;
// every other client module gets its token this way.
import type {
  ApiErrorBody,
  ChatRequest,
  ChatResponse,
  ClientProgressEvent,
  PrivacyExport,
  PrivacyRequest,
  ProgressSnapshot,
  Result,
  TtsQuery,
} from '../lib/types.ts';

export interface ApiClientConfig {
  baseUrl?: string; // defaults to same-origin, i.e. ''
  getAccessToken: () => Promise<string | null>;
  fetchFn?: typeof fetch;
}

async function toResult<T>(res: Response): Promise<Result<T>> {
  if (res.ok) return { ok: true, value: (await res.json()) as T };
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  return {
    ok: false,
    error: body?.error ?? { code: 'internal', message: `http_${res.status}` },
  };
}

export interface ApiClient {
  transcribe(audio: Blob, purpose: string, referenceText?: string): Promise<Result<unknown>>;
  chat(req: ChatRequest): Promise<Result<ChatResponse>>;
  tts(query: TtsQuery): Promise<Result<Blob>>;
  getProgress(tzOffsetMin: number): Promise<Result<ProgressSnapshot>>;
  postProgress(event: ClientProgressEvent): Promise<Result<{ ok: true }>>;
  getPrivacyExport(): Promise<Result<PrivacyExport>>;
  postPrivacy(req: PrivacyRequest): Promise<Result<{ ok: true }>>;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const base = config.baseUrl ?? '';
  const fetchFn = config.fetchFn ?? fetch;

  async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await config.getAccessToken();
    const headers = new Headers(init.headers);
    if (token !== null) headers.set('authorization', `Bearer ${token}`);
    return fetchFn(`${base}${path}`, { ...init, headers });
  }

  return {
    async transcribe(audio, purpose, referenceText) {
      const form = new FormData();
      form.set('audio', audio);
      form.set('purpose', purpose);
      if (referenceText !== undefined) form.set('referenceText', referenceText);
      const res = await authedFetch('/api/transcribe', { method: 'POST', body: form });
      return toResult(res);
    },

    async chat(req) {
      const res = await authedFetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      return toResult(res);
    },

    async tts(query) {
      const params = new URLSearchParams({ catalog: query.catalog, id: query.id });
      const res = await authedFetch(`/api/tts?${params.toString()}`);
      if (!res.ok) return toResult(res);
      return { ok: true, value: await res.blob() };
    },

    async getProgress(tzOffsetMin) {
      const res = await authedFetch(`/api/progress?tz=${tzOffsetMin}`);
      return toResult(res);
    },

    async postProgress(event) {
      const res = await authedFetch('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      });
      return toResult(res);
    },

    async getPrivacyExport() {
      const res = await authedFetch('/api/privacy?export=1');
      return toResult(res);
    },

    async postPrivacy(req) {
      const res = await authedFetch('/api/privacy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      return toResult(res);
    },
  };
}
