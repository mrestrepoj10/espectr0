import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function CustomSidebarTrigger() {
	return (
		<Tooltip>
			<SidebarTrigger render={<TooltipTrigger delay={1000} />} />
			<TooltipContent className="px-2 py-1" side="right">
				Alternar barra lateral{" "}
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>b</Kbd>
				</KbdGroup>
			</TooltipContent>
		</Tooltip>
	);
}
