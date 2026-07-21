"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { navLinks } from "@/components/app-shared";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function AppHeader() {
  const pathname = usePathname();
  const moduleName =
    navLinks.find((item) => item.path === pathname)?.title ??
    (pathname === "/" ? "Calculadora" : "espectr0");

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs module={moduleName} />
      </div>
      <div className="flex items-center gap-3">
        <Badge className="font-mono" variant="outline">
          NSR-10
        </Badge>
        <Separator
          className="h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
