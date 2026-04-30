import { ProxyCenterManager } from "@/components/proxy-center-manager";
import { getProxyBindings, getProxyNodes } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function ProxyCenterPage() {
  const [bindings, nodes] = await Promise.all([getProxyBindings(), getProxyNodes()]);

  return <ProxyCenterManager initialNodes={nodes.length > 0 ? nodes : bindings.nodes} initialAccounts={bindings.accounts} />;
}
