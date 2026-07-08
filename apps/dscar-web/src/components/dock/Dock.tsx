"use client";

import { forwardRef, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DockModuleChild {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
}

export interface DockModule {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
  active: boolean;
  children?: DockModuleChild[];
}

interface DockProps {
  modules: DockModule[];
  onNavigate: (href: string) => void;
  className?: string;
}

const BASE_SIZE = 44;
const MAGNIFIED_SIZE = 64;
const DISTANCE = 140;
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

const DockItemButton = forwardRef<
  HTMLButtonElement,
  {
    module: DockModule;
    mouseX: MotionValue<number>;
    magnify: boolean;
    onClick?: () => void;
  }
>(function DockItemButton({ module: mod, mouseX, magnify, onClick, ...rest }, forwardedRef) {
  const ref = useRef<HTMLButtonElement>(null);
  // ponytail: callback ref simples mesclando o ref interno (magnification) com o do Radix Slot
  const setRefs = (node: HTMLButtonElement | null) => {
    ref.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const distanceFromMouse = useTransform(mouseX, (val: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return DISTANCE;
    return val - rect.x - rect.width / 2;
  });
  const targetSize = useTransform(
    distanceFromMouse,
    [-DISTANCE, 0, DISTANCE],
    magnify ? [BASE_SIZE, MAGNIFIED_SIZE, BASE_SIZE] : [BASE_SIZE, BASE_SIZE, BASE_SIZE]
  );
  const size = useSpring(targetSize, SPRING);

  return (
    <motion.button
      {...rest}
      ref={setRefs}
      type="button"
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label={mod.label}
      title={mod.label}
      aria-current={mod.active ? "page" : undefined}
      {...(mod.children
        ? { "aria-haspopup": "dialog" as const }
        : {})}
      className={cn(
        "relative flex items-center justify-center rounded-xl border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mod.active
          ? "bg-primary/20 border-primary text-primary"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <mod.icon className="h-5 w-5" />
      {mod.badge != null && mod.badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold font-mono flex items-center justify-center px-1 leading-none">
          {mod.badge > 9 ? "9+" : mod.badge}
        </span>
      )}
    </motion.button>
  );
});

export function Dock({ modules, onNavigate, className }: DockProps) {
  const reduce = useReducedMotion();
  const mouseX = useMotionValue(Infinity);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <motion.nav
      aria-label="Módulos"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "flex items-end gap-3 rounded-2xl border border-border bg-card/90 px-3 shadow-lg backdrop-blur-md",
        "h-[60px] pb-2",
        className
      )}
    >
      {modules.map((mod) =>
        mod.children ? (
          <Popover
            key={mod.id}
            open={openId === mod.id}
            onOpenChange={(open) => setOpenId(open ? mod.id : null)}
          >
            <PopoverTrigger asChild>
              <DockItemButton module={mod} mouseX={mouseX} magnify={reduce === false} />
            </PopoverTrigger>
            <PopoverContent side="top" sideOffset={12} className="w-52 p-1.5">
              <p className="label-mono px-2.5 pt-1 pb-1.5 text-muted-foreground">
                {mod.label}
              </p>
              {mod.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setOpenId(null);
                    onNavigate(child.href);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                    child.active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4 flex-shrink-0" />
                  {child.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : (
          <DockItemButton
            key={mod.id}
            module={mod}
            mouseX={mouseX}
            magnify={reduce === false}
            onClick={() => mod.href && onNavigate(mod.href)}
          />
        )
      )}
    </motion.nav>
  );
}
