import type React from "react";

export function LogoIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 18 16"
      {...props}
    >
      <path
        d="M1 8h3l2.5-6L10 14l2.5-6H17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LogoIcon className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold tracking-tight">espectr0</span>
        <span className="mt-1 font-mono text-[10px] text-muted-foreground">
          sism0 labs
        </span>
      </span>
    </span>
  );
}
