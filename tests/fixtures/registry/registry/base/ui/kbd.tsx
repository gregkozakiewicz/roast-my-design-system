import { cn } from "@/lib/utils"
export function Ukbd({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="kbd" className={cn("inline-flex rounded-md border px-2 text-xs", className)} {...props} />
}
