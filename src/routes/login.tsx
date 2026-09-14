import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { meQuery } from "@api/queries";
import { LoginPage } from "@views/login/LoginPage";

const searchSchema = z.object({ reason: z.enum(["forbidden"]).optional() });

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context: { queryClient } }) => {
    const me = await queryClient.fetchQuery(meQuery());
    if (me.role === "ADMIN") throw redirect({ to: "/" });
    return { me };
  },
  component: LoginPage,
});
