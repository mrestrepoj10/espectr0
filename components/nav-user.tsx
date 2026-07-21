"use client";

import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const user = {
  name: "María A.",
  role: "ing.estructural @correo",
};

export function NavUser() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menú de usuario de María A."
        nativeButton={false}
        render={<Avatar className="size-8" />}
      >
        <AvatarFallback>MA</AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
            <span className="font-medium text-foreground">{user.name}</span>
            <span className="truncate text-muted-foreground text-xs">{user.role}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon />
            Preferencias
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive">
            <LogOutIcon />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
