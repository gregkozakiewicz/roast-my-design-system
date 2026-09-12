"use client";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Message({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex gap-2 text-gray-700", className)} {...props} />;
}
