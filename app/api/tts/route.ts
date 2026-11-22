import { ttsHandler } from '../../../src/server/handlers/tts.ts';
import { getServerDeps } from '../../../src/server/deps.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return ttsHandler(req, getServerDeps());
}
