import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn("animate-pulse rounded bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
