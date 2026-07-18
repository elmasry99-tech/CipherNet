import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://cyphernet-backend.onrender.com";

async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Strip the /api prefix to get the real backend path
  const backendPath = pathname.replace(/^\/api/, "");
  const url = `${BACKEND_URL}${backendPath}${search}`;

  const headers = new Headers(req.headers);
  // Remove host so the backend sees its own host
  headers.delete("host");

  const init: RequestInit = {
    method: req.method,
    headers,
    // @ts-expect-error duplex is required for streaming body in Node 18+
    duplex: "half",
  };

  if (req.body && !["GET", "HEAD"].includes(req.method)) {
    init.body = req.body;
  }

  const upstream = await fetch(url, init);

  const responseHeaders = new Headers(upstream.headers);
  // fetch() transparently decompresses the body, so the original
  // content-encoding/content-length (which describe the compressed
  // bytes) no longer match what we're actually sending — drop them
  // so the client doesn't truncate the response waiting for a byte
  // count that refers to the pre-decompression size.
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("content-length");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
