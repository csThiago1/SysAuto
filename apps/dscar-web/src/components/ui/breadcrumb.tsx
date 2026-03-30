import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Route } from "next";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }): React.ReactElement {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <li>
              {item.href ? (
                <Link href={item.href as Route} className="hover:text-neutral-900 transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-neutral-900 font-medium">{item.label}</span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}
