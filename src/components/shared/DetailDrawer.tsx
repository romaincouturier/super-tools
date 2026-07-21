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
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <SheetContent
      hideCloseButton
      className={cn("w-full", contentClassName)}
      onEscapeKeyDown={() => onOpenChange(false)}
    >
      <SheetHeader className={headerClassName}>
        <SheetTitle className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            title="Fermer"
            aria-label="Fermer"
            className="shrink-0 h-9 w-9 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
          <span className="truncate flex-1 min-w-0">{title}</span>
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto max-w-[50%] sm:max-w-none">
            {actions}
          </div>
        </SheetTitle>
      </SheetHeader>

      {children}
    </SheetContent>
  </Sheet>
);

export default DetailDrawer;
