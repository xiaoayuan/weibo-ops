import { notFound } from "next/navigation";

import { PlaceholderModule } from "@/components/placeholder-module";
import { navItems } from "@/lib/nav";

export const dynamic = "force-dynamic";

type PlaceholderPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PlaceholderPage({ params }: PlaceholderPageProps) {
  const { slug } = await params;
  const item = navItems.find((entry) => entry.href === `/${slug}`);

  if (
    !item ||
    item.href === "/accounts" ||
    item.href === "/logs" ||
    item.href === "/settings" ||
    item.href === "/plans" ||
    item.href === "/topic-tasks" ||
    item.href === "/proxy-center" ||
    item.href === "/users" ||
    item.href === "/super-topics" ||
    item.href === "/copywriting" ||
    item.href === "/ops" ||
    item.href === "/scheduler" ||
    item.href === "/interactions" ||
    item.href === "/traffic" ||
    item.href === "/performance"
  ) {
    notFound();
  }

  return <PlaceholderModule title={item.label} description={item.description} />;
}
