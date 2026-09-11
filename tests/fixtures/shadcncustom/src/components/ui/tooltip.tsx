import * as React from "react"
import { cn } from "@/lib/utils"

const Tooltip = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
))
Tooltip.displayName = "Tooltip"

export { Tooltip }
