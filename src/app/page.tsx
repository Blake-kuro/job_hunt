import { connection } from "next/server";
import { getCurrentUserId } from "@/server/auth";
import { getProgress, listJobs } from "@/server/services/jobs";
import { parseJobListQuery } from "@entities/job";
import { JobBoardPage } from "@pages/job-board/JobBoardPage";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const query = parseJobListQuery(await searchParams);
  const userId = await getCurrentUserId();
  const [result, progress] = await Promise.all([listJobs(query, userId), getProgress(userId)]);
  return <JobBoardPage query={query} result={result} progress={progress} />;
}
