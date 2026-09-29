export function authorize(request: Request): Response | null {
  const expected = process.env.PRIORITIZE_API_KEY;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "PRIORITIZE_API_KEY is not configured." },
        { status: 500 },
      );
    }
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const token = bearer || request.headers.get("x-api-key")?.trim();
  if (token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
