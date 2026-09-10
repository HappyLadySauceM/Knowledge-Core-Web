"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 15_000, refetchOnWindowFocus: false }, mutations: { retry: false } } }));
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => { const redirect = () => { const locale = pathname.split("/")[1] === "en" ? "en" : "zh-CN"; router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}`); }; window.addEventListener("knowledge-core:unauthorized", redirect); return () => window.removeEventListener("knowledge-core:unauthorized", redirect); }, [pathname, router]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
