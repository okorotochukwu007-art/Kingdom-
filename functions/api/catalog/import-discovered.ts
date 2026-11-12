// Cloudflare Pages Edge Function handler for POST /api/catalog/import-discovered
export const onRequestPost = async (context: { request: Request }): Promise<Response> => {
  try {
    const body = await context.request.json().catch(() => ({}));
    return new Response(
      JSON.stringify({
        ok: true,
        added: Boolean(body?.video?.youtube_video_id),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(JSON.stringify({ ok: true, added: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
