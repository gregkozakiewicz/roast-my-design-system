import * as React from "react"
import { cn } from "@/lib/utils"
export function Button({ className, ...props }: React.ComponentProps<"button">) {
  return <button className={cn("inline-flex h-9 items-center rounded-md bg-neutral-900 px-4 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900", className)} {...props} />
}
