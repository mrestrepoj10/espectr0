import type { LucideIcon } from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ConstructionStateProps {
	description: string;
	icon: LucideIcon;
	title: string;
}

export function ConstructionState({
	description,
	icon: Icon,
	title,
}: ConstructionStateProps) {
	return (
		<section
			aria-labelledby="construction-state-title"
			className="flex flex-1 items-center justify-center py-8 md:py-12"
		>
			<Card className="w-full max-w-2xl">
				<CardHeader className="justify-items-center text-center">
					<Icon aria-hidden="true" className="size-8" />
					<CardTitle>
						<h1 id="construction-state-title">{title}</h1>
					</CardTitle>
					<CardDescription className="max-w-lg">
						{description}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div
						aria-hidden="true"
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						<div className="flex items-center gap-3">
							<Skeleton className="size-10 shrink-0 rounded-full" />
							<div className="flex flex-1 flex-col gap-2">
								<Skeleton className="h-3 w-2/5" />
								<Skeleton className="h-3 w-3/5" />
							</div>
						</div>
						<Skeleton className="h-28 w-full" />
					</div>
					<p className="mt-6 text-center text-sm text-muted-foreground">
						En construcción
					</p>
				</CardContent>
			</Card>
		</section>
	);
}
