import { privacyHandler } from '../../../src/server/handlers/privacy.ts';
import { getServerDeps } from '../../../src/server/deps.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return privacyHandler(req, getServerDeps());
}

export async function POST(req: Request): Promise<Response> {
  return privacyHandler(req, getServerDeps());
}
