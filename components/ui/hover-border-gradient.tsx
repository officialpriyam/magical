"use client";
import React from "react";
import { cn } from "@/lib/utils";

export function HoverBorderGradient({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-full p-[1px] transition-all duration-300",
        "bg-gradient-to-r from-transparent via-neutral-400 to-transparent",
        "dark:from-transparent dark:via-neutral-600 dark:to-transparent",
        "hover:bg-gradient-to-r hover:from-blue-500 hover:via-purple-500 hover:to-pink-500",
        "dark:hover:from-blue-400 dark:hover:via-purple-400 dark:hover:to-pink-400",
        className
      )}
      {...props}
    >
      <div className="relative z-10 rounded-full bg-white px-4 py-2 text-black dark:bg-black dark:text-white">
        {children}
      </div>
      <div className="absolute inset-0 z-0 rounded-full bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-transparent dark:via-black dark:to-transparent" />
    </div>
  );
}
