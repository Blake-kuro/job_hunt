import { handle, json } from "@/server/lib/http";
import { getCurrentUser } from "@/server/services/users";

export async function GET() {
  return handle(async () => json(await getCurrentUser()));
}
