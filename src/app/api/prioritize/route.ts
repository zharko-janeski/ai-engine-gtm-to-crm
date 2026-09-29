import { authorize } from "@/lib/auth";
import { formatZodError, prioritizeAccounts } from "@/lib/decide";
import { sampleBatch } from "@/lib/sample";
import { ZodError } from "zod";

export const maxDuration = 60;

export function GET() {
  return Response.json({
    method: "POST",
    auth: "Send Authorization: Bearer <PRIORITIZE_API_KEY> when that key is set. Production requires it.",
    description:
      "Ranks a set of WSQ accounts and marks the top capacity slots as workNow. Does not contact anyone.",
    example: sampleBatch,
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
    return Response.json(await prioritizeAccounts(body));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid prioritize request", issues: formatZodError(error) },
        { status: 400 },
      );
    }
    throw error;
  }
}
