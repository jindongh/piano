export async function handleAuthPopupRequest(_req: Request): Promise<Response> {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}
