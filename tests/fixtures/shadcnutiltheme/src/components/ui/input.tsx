import * as React from "react"
import { cn } from "@/lib/utils"
export function Input({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50", className)} {...props} />
}
