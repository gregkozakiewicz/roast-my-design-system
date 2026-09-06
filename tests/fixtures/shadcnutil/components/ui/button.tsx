import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("inline-flex items-center rounded-md text-sm font-medium", {
  variants: {
    variant: {
      default: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900",
      destructive: "bg-red-500 text-zinc-50 hover:bg-red-500/90",
      outline: "border border-zinc-200 bg-white hover:bg-zinc-100",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, className })} {...props} />;
}
