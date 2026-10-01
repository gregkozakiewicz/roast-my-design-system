import * as React from "react"
import { cn } from "@/lib/utils"
export function Button({ className, ...props }: React.ComponentProps<"button">) {
  return <button data-slot="button" className={cn("inline-flex h-9 items-center rounded-md bg-primary px-4 text-primary-foreground focus-visible:ring-[3px]", className)} {...props} />
}
