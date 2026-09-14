import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { meQuery } from "@api/queries";
import { LoginPage } from "@views/login/LoginPage";
import { ApiError } from "../api/client";

const loginSearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context: { queryClient }, search }) => {
    try {
      await queryClient.fetchQuery(meQuery());
      throw redirect({ to: "/" });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    return { redirectTo: search.redirect };
  },
  component: LoginPage,
});
