// Cloudflare Pages Edge Function for POST /api/reminders/subscribe
export const onRequestPost = async (context: { request: Request }): Promise<Response> => {
  try {
    const body = await context.request.json().catch(() => ({}));
    return new Response(
      JSON.stringify({
        ok: true,
        subscription: {
          subscriberKey: body.subscriberKey || 'anonymous',
          email: body.email || '',
          whatsappPhone: body.whatsappPhone || '',
          webPushEnabled: Boolean(body.webPushEnabled),
          emailEnabled: Boolean(body.emailEnabled),
          whatsappEnabled: Boolean(body.whatsappEnabled),
          advanceMinutes: Number(body.advanceMinutes) || 10,
          programIds: Array.isArray(body.programIds) ? body.programIds : [],
          updatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
