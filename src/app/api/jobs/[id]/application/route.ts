import { z } from "zod";
import { handle, json, readJson } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { setApplication } from "@/server/services/jobs";

const idSchema = z.coerce.number().int().positive();
const bodySchema = z.object({ status: z.enum(["APPLIED", "INTERVIEWING"]) });

export async function PUT(req: Request, ctx: RouteContext<"/api/jobs/[id]/application">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const { status } = await readJson(req, bodySchema);
    const userId = await getCurrentUserId();
    return json(await setApplication(jobId, userId, status));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/jobs/[id]/application">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const userId = await getCurrentUserId();
    return json(await setApplication(jobId, userId, null));
  });
}
