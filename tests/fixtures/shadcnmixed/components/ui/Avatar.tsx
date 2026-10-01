import * as React from "react"
import { cn } from "@/lib/utils"
export function Avatar({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="avatar" className={cn("relative flex size-[2.25rem] shrink-0 overflow-hidden rounded-full bg-zinc-100", className)} {...props} />
}
