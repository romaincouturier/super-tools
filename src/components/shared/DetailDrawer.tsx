/**
 * Shared detail drawer shell used by mission and CRM detail views.
 * Provides consistent behavior: close on overlay click, no X button,
 * title with optional action buttons.
 */
import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Buttons rendered to the right of the title */
  actions?: ReactNode;
  children: ReactNode;
  /** Classes applied to SheetContent (width, scroll, layout) */
  contentClassName?: string;
  /** Classes applied to SheetHeader */
  headerClassName?: string;
}

const DetailDrawer = ({
  open,
  onOpenChange,
  title,
  actions,
  children,
  contentClassName,
  headerClassName,
}: DetailDrawerProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent hideCloseButton className={cn("w-full", contentClassName)}>
      <SheetHeader className={headerClassName}>
        <SheetTitle className="flex items-center justify-between gap-2">
          <span className="truncate flex-1">{title}</span>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </SheetTitle>
      </SheetHeader>
      {children}
    </SheetContent>
  </Sheet>
);

export default DetailDrawer;
