import { chatHandler } from '../../../src/server/handlers/chat.ts';
import { getServerDeps } from '../../../src/server/deps.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return chatHandler(req, getServerDeps());
}
