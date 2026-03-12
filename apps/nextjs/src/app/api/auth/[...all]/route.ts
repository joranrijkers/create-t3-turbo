import { auth } from "~/auth/server";

const isDev = process.env.NODE_ENV === "development";

async function handleAuthRequest(
  req: Request,
  handler: typeof auth.handler,
): Promise<Response> {
  try {
    return await handler(req as Parameters<typeof auth.handler>[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Better Auth] Unexpected error:", message, stack);

    if (isDev) {
      return new Response(
        JSON.stringify({
          code: "UNEXPECTED_ERROR",
          message: "Unexpected error",
          dev: { message, stack: stack?.split("\n").slice(0, 8) },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({ code: "UNEXPECTED_ERROR", message: "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const GET = (req: Request) => handleAuthRequest(req, auth.handler);
export const POST = (req: Request) => handleAuthRequest(req, auth.handler);
