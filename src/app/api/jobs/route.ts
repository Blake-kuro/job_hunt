import { handle, json, readQuery } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { listJobs } from "@/server/services/jobs";
import { jobListQuerySchema } from "@entities/job";

export async function GET(req: Request) {
  return handle(async () => {
    const query = readQuery(req, jobListQuerySchema);
    const userId = await getCurrentUserId();
    return json(await listJobs(query, userId));
  });
}
