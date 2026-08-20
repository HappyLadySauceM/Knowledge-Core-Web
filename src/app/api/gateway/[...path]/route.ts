import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

async function forward(request: Request, path: string[]) {
  const cookieStore = await cookies();
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const name of ["if-match", "idempotency-key", "x-request-id", "traceparent", "tracestate"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const accessToken = cookieStore.get("kc_access")?.value;
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const url = new URL(`/${path.join("/")}`, gatewayBaseUrl);
  url.search = new URL(request.url).search;
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });
  const body = await response.arrayBuffer();
  const responseHeaders = new Headers();
  const responseType = response.headers.get("content-type");
  if (responseType) responseHeaders.set("content-type", responseType);
  for (const name of ["etag", "location", "x-request-id", "x-trace-id", "retry-after", "www-authenticate"]) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(body, { status: response.status, headers: responseHeaders });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
