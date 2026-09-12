import { Hono } from "hono";
import type { Env } from "../env";
import { getCurrentUser } from "../services/users";

export const meRoutes = new Hono<Env>().get("/", async (c) => c.json(await getCurrentUser(c.var.userId)));
