import { authorize } from "@/lib/auth";
import { formatZodError, qualifyAccount } from "@/lib/decide";
import { northline } from "@/lib/sample";
import { ZodError } from "zod";

export const maxDuration = 60;

export function GET() {
  return Response.json({
    method: "POST",
    auth: "Send Authorization: Bearer <PRIORITIZE_API_KEY> when that key is set. Production requires it.",
    description:
      "Scores one WSQ account that Clay has already qualified. Returns priority, evidence, and a recommended action. Does not contact the account.",
    example: northline,
  });
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    return Response.json(await qualifyAccount(body));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid account", issues: formatZodError(error) },
        { status: 400 },
      );
    }
    throw error;
  }
}
