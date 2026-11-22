import { progressHandler } from '../../../src/server/handlers/progress.ts';
import { getServerDeps } from '../../../src/server/deps.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return progressHandler(req, getServerDeps());
}

export async function POST(req: Request): Promise<Response> {
  return progressHandler(req, getServerDeps());
}
