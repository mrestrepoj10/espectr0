"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { navLinks } from "@/components/app-shared";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { ThemeSwitch } from "@/components/theme-switch";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppHeader() {
  const pathname = usePathname();
  const moduleName =
    pathname === "/" || pathname === "/calculadora"
      ? "Calculadora de espectro"
      : (navLinks.find((item) => item.path === pathname)?.title ?? "espectr0");

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
        <ThemeSwitch />
        <Separator
          className="h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <a
          aria-label="Abrir repositorio de espectr0 en GitHub"
          className={buttonVariants({
            className: "size-10 transition-transform active:scale-[0.96]",
            size: "icon-lg",
            variant: "ghost",
          })}
          href="https://github.com/mrestrepoj10/espectr0"
          rel="noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.96 10.96 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
          </svg>
        </a>
      </div>
    </header>
  );
}
