import { requireApiRole } from "@/src/lib/permissions";
import { getTrafficSummary } from "@/src/lib/traffic";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const data = await getTrafficSummary(auth.session.id);
  return Response.json({ success: true, data });
}
