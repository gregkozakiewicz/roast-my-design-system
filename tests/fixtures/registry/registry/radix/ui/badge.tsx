import { cn } from "@/lib/utils"
export function Ubadge({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="badge" className={cn("inline-flex rounded-md border px-2 text-xs", className)} {...props} />
}
