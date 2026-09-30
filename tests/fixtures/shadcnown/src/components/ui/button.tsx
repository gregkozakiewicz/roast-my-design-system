import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border border-edge bg-surface-raised text-ink shadow-sm", className)} {...props} />
))
Button.displayName = "Button"

export { Button }
