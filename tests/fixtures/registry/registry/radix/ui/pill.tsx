import { cn } from "@/lib/utils"
export function Upill({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="pill" className={cn("inline-flex rounded-md border px-2 text-xs", className)} {...props} />
}
