import { requireApiRole } from "@/src/lib/permissions";
import { listVisibleActionJobs } from "@/src/lib/action-jobs";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const jobs = await listVisibleActionJobs(auth.session);
  return Response.json({ success: true, data: jobs });
}
