// src/server/env.ts
//
// Reads required server-only env vars once, with clear errors naming every
// missing variable (never the value of any variable — nothing here is ever
// logged). `loadEnv()` is called lazily by `deps.ts`'s singletons, not at
// module load time, so a test importing this module never needs real env
// vars set.

export interface ServerEnv {
  openaiApiKey: string;
  anthropicApiKey: string | null;
  llmProvider: 'anthropic' | 'openai';
  anthropicModel: string;
  openaiChatModel: string;
  openaiTtsModel: string;
  openaiTtsVoice: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  allowedOrigins: readonly string[];
  trustedProxyHops: number;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

export function loadEnv(): ServerEnv {
  const missing: string[] = [];

  const openaiApiKey = readEnv('OPENAI_API_KEY');
  if (!openaiApiKey) missing.push('OPENAI_API_KEY');

  const llmProviderRaw = readEnv('LLM_PROVIDER') ?? 'anthropic';
  if (llmProviderRaw !== 'anthropic' && llmProviderRaw !== 'openai') {
    missing.push("LLM_PROVIDER (must be 'anthropic' or 'openai')");
  }
  const llmProvider = llmProviderRaw === 'openai' ? 'openai' : 'anthropic';

  const anthropicApiKey = readEnv('ANTHROPIC_API_KEY') ?? null;
  if (llmProvider === 'anthropic' && !anthropicApiKey) missing.push('ANTHROPIC_API_KEY');

  const supabaseUrl = readEnv('SUPABASE_URL');
  if (!supabaseUrl) missing.push('SUPABASE_URL');

  // Accept either the legacy ANON key name or the newer sb_publishable_ key,
  // both read from SUPABASE_ANON_KEY per docs/PLAN.md §9.
  const supabaseAnonKey = readEnv('SUPABASE_ANON_KEY') ?? readEnv('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)');

  const allowedOriginsRaw = readEnv('ALLOWED_ORIGINS');
  const allowedOrigins = allowedOriginsRaw
    ? allowedOriginsRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : [];
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    missing.push('ALLOWED_ORIGINS');
  }

  if (missing.length > 0) {
    throw new Error(`Missing or invalid required environment variable(s): ${missing.join(', ')}`);
  }

  const trustedProxyHopsRaw = readEnv('TRUSTED_PROXY_HOPS');
  const trustedProxyHops = trustedProxyHopsRaw ? Number(trustedProxyHopsRaw) : 1;

  return {
    openaiApiKey: openaiApiKey!,
    anthropicApiKey,
    llmProvider,
    anthropicModel: readEnv('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest',
    openaiChatModel: readEnv('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
    openaiTtsModel: readEnv('OPENAI_TTS_MODEL') ?? 'tts-1',
    openaiTtsVoice: readEnv('OPENAI_TTS_VOICE') ?? 'alloy',
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    allowedOrigins,
    trustedProxyHops: Number.isFinite(trustedProxyHops) && trustedProxyHops >= 0 ? trustedProxyHops : 1,
  };
}
