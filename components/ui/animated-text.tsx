'use client'

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export interface AnimatedTextProps {
  children: React.ReactNode
  className?: string
}

export function AnimatedText({ children, className }: AnimatedTextProps) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(className)}
    >
      {children}
    </motion.h1>
  )
}
