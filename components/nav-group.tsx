"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarNavGroup } from "@/components/app-shared";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavGroup({ label, items }: SidebarNavGroup) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => {
          const isActive =
            pathname === item.path || (pathname === "/" && item.path === "/calculadora");

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive}
                render={<Link href={item.path} />}
                tooltip={item.title}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
