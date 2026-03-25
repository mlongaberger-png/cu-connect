/**
 * MobileSelect — drop-in replacement for Radix Select.
 * On mobile (< 768px): renders items as a bottom-sheet drawer.
 * On desktop: renders the standard Radix Select.
 *
 * Usage (identical API to shadcn Select):
 *   <MobileSelect value={val} onValueChange={setVal} placeholder="Choose…">
 *     <MobileSelectItem value="a">Option A</MobileSelectItem>
 *     <MobileSelectItem value="b">Option B</MobileSelectItem>
 *   </MobileSelect>
 */
import React, { useState, Children, isValidElement } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Thin wrapper — on desktop just forwards to Radix SelectItem */
export function MobileSelectItem({ value, children, className }) {
  return (
    <SelectItem value={value} className={className}>
      {children}
    </SelectItem>
  );
}

export function MobileSelect({
  value,
  onValueChange,
  placeholder = "Select…",
  children,
  className,
  triggerClassName,
  label,
  disabled = false,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Extract items from children (MobileSelectItem or SelectItem)
  const items = Children.toArray(children).filter(isValidElement);

  // Find the label for the current value
  const selectedLabel = (() => {
    const match = items.find((child) => child.props.value === value);
    return match ? match.props.children : null;
  })();

  if (!isMobile) {
    // Desktop — standard Radix Select, pass children through
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={cn(triggerClassName, className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {items.map((child) => (
            <SelectItem key={child.props.value} value={child.props.value} className={child.props.className}>
              {child.props.children}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile — trigger button + Drawer bottom sheet
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
          "text-left disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
          className
        )}
      >
        <span className={cn(selectedLabel ? "text-foreground" : "text-muted-foreground")}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          {label && (
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-base text-foreground">{label}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="px-4 pb-safe-bottom pb-6 space-y-1 overflow-y-auto max-h-[60vh]">
            {items.map((child) => {
              const isSelected = child.props.value === value;
              return (
                <button
                  key={child.props.value}
                  type="button"
                  onClick={() => {
                    onValueChange?.(child.props.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-surface active:bg-surface"
                  )}
                >
                  <span>{child.props.children}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default MobileSelect;