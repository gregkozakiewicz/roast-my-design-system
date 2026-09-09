import * as React from "react";
import { cn } from "@/lib/utils";

// Installed by `shadcn add dropdown-menu`, not used anywhere yet.
export function DropdownMenu({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-input bg-background p-2", className)} {...props} />;
}
