"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

const subscribe = () => () => {};

export function ThemeSwitch() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (!mounted) {
    return <span aria-hidden className="h-4 w-7" />;
  }

  return (
    <Switch
      aria-label="Cambiar tema"
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      size="sm"
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </Switch>
  );
}
