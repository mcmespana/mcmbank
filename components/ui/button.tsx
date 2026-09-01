import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Sin sombra, sin `backdrop-blur` y sin `active:scale`: un botón no se eleva,
  // no desenfoca lo que tiene detrás y no encoge al pulsarlo (design.md §3.3,
  // §5.1, §5.3). Lo que sí tiene que verse siempre es el anillo de foco.
  //
  // `toque` amplía la zona sensible a 44 px en pantallas táctiles sin engordar
  // el dibujo (ver `app/globals.css`). Dos botones contiguos separados por
  // `gap-2` solapan 4 px de zona, justo en el hueco: quien toque ahí quería
  // uno de los dos y recibe uno de los dos.
  "toque inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        /**
         * Rojo sólido. Hoy lo usan tanto los botones que **confirman** un
         * borrado dentro de un diálogo (correcto: ahí conviene que pese) como
         * algunos que solo **abren** ese diálogo desde una fila o una barra,
         * donde grita de más. Separarlos en dos variantes es design-plans/029.
         */
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-background hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Un escalón más altos en móvil que en escritorio, exactamente igual que
      // `Input` y `MoneyInput`: así un botón y el campo que tiene al lado miden
      // lo mismo en las dos pantallas, que es lo que antes se compensaba a mano
      // con `className="h-10"` en media docena de sitios.
      size: {
        default: "h-9 px-3 md:h-8",
        sm: "h-8 rounded-sm px-2.5 text-xs md:h-7",
        lg: "h-10 px-4 md:h-9",
        icon: "h-9 w-9 md:h-8 md:w-8",
        "icon-sm": "h-8 w-8 rounded-sm md:h-7 md:w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
