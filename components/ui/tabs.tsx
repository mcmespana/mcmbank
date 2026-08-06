"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // min-h-12 (no h-12): el carril debe abrazar al trigger más alto. Con una
      // altura fija, el trigger activo desbordaba el content box y la píldora
      // quedaba descentrada (7px arriba / 3px abajo).
      "inline-flex min-h-12 items-center justify-center rounded-2xl bg-muted/60 backdrop-blur-xl p-1.5 text-muted-foreground border border-border/30 shadow-lg",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // `border border-transparent` en la base: antes el borde lo añadía solo el
      // estado activo, así que la pestaña activa medía 2px más que las inactivas
      // y el cambio de pestaña desplazaba el layout. Reservando el borde en
      // ambos estados, todas miden igual y la píldora queda centrada.
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card/90 data-[state=active]:backdrop-blur-md data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border-border/50 hover:bg-card/50 hover:text-foreground/80",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=inactive]:hidden",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
