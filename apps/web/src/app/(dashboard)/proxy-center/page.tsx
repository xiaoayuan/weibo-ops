import { ProxyCenterManager } from "@/components/proxy-center-manager";
import { getProxyBindings, getProxyNodes } from "@/lib/app-data";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProxyCenterPage() {
  await requireRole("ADMIN");

  const [bindings, nodes] = await Promise.all([getProxyBindings(), getProxyNodes()]);

  return <ProxyCenterManager initialNodes={nodes.length > 0 ? nodes : bindings.nodes} initialAccounts={bindings.accounts} />;
}
