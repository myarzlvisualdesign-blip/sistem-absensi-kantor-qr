import type { NextRequest } from 'next/server';

export async function handler(request: NextRequest) {
  return new Response('Next.js app running on Cloudflare Pages Functions', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
