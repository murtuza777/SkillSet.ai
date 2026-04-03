import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card rounded-[28px] p-6", className)} {...props} />;
}
