import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    country: req.headers.get('x-vercel-ip-country') ?? 'Unknown',
    city:    req.headers.get('x-vercel-ip-city')    ?? null,
  })
}
