import { cn } from "@/lib/utils"
export function Utag({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="tag" className={cn("inline-flex rounded-md border px-2 text-xs", className)} {...props} />
}
