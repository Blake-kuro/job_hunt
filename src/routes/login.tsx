import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { meQuery } from "@api/queries";
import { LoginPage } from "@views/login/LoginPage";

const loginSearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context: { queryClient }, search }) => {
    const me = await queryClient.fetchQuery(meQuery());
    if (me.tier !== "GUEST") throw redirect({ to: "/" });
    return { redirectTo: search.redirect };
  },
  component: LoginPage,
});
