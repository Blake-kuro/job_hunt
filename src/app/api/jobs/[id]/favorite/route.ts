import { z } from "zod";
import { handle, json } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { setFavorite } from "@/server/services/jobs";

const idSchema = z.coerce.number().int().positive();

export async function PUT(_req: Request, ctx: RouteContext<"/api/jobs/[id]/favorite">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const userId = await getCurrentUserId();
    return json(await setFavorite(jobId, userId, true));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/jobs/[id]/favorite">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const userId = await getCurrentUserId();
    return json(await setFavorite(jobId, userId, false));
  });
}
