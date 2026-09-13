import { cn } from "@/lib/utils"
export function Ucard({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="card" className={cn("inline-flex rounded-md border px-2 text-xs", className)} {...props} />
}
