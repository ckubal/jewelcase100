import { NextRequest, NextResponse } from 'next/server';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url);

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch upstream' }, { status: 502 });
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 413 });
    }

    const buffer = await upstream.arrayBuffer();

    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 413 });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Cover proxy error:', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
