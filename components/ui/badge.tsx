import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/90 text-primary-foreground hover:bg-primary hover:shadow-md",
        secondary:
          "border-secondary/30 bg-secondary/80 backdrop-blur-md text-secondary-foreground hover:bg-secondary hover:shadow-md",
        destructive:
          "border-destructive/20 bg-destructive/90 text-destructive-foreground hover:bg-destructive hover:shadow-md",
        outline: "text-foreground border-border/50 bg-card/60 backdrop-blur-md hover:bg-card/80 hover:shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
