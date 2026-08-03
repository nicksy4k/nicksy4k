import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyHint?: string;
  className?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;

  /** Fired when the user presses Enter (after the value has been committed). */
  onEnterCommit?: (value: string) => void;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyHint = "Press Enter to add",
  className,
  autoFocus = false,
  invalid = false,

  id,
  ariaLabel,
  inputRef,
  onEnterCommit,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  const localRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const listId = React.useId();

  // Focus (but never open) on mount when requested.
  React.useEffect(() => {
    if (!autoFocus) return;
    const raf = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const query = value.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!query) return options.slice(0, 50);
    return options.filter((o) => o.toLowerCase().includes(query)).slice(0, 50);
  }, [options, query]);

  const exactMatch = options.some((o) => o.toLowerCase() === query);
  const showAddRow = Boolean(query) && !exactMatch;
  const rowCount = filtered.length + (showAddRow ? 1 : 0);

  React.useEffect(() => {
    setHighlight((h) => (h >= rowCount ? -1 : h));
  }, [rowCount]);

  const openList = () => {
    setOpen(true);
    setHighlight(-1);
  };

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
    setHighlight(-1);
    ref.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlight((h) => (rowCount === 0 ? -1 : (h + 1) % rowCount));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlight((h) => (rowCount === 0 ? -1 : (h <= 0 ? rowCount - 1 : h - 1)));
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlight(-1);
      }
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlight >= 0) {
        const picked = highlight < filtered.length ? filtered[highlight] : value.trim();
        pick(picked);
        onEnterCommit?.(picked);
        return;
      }
      setOpen(false);
      setHighlight(-1);
      onEnterCommit?.(value.trim());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <input
            id={id}
            ref={ref}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              setHighlight(-1);
              if (!open) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background pl-3 pr-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              invalid && "border-destructive focus-visible:ring-destructive",
            )}

          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? "Hide suggestions" : "Show suggestions"}
            onClick={() => {
              if (open) {
                setOpen(false);
              } else {
                openList();
              }
              ref.current?.focus();
            }}
            className="absolute right-0 top-0 h-10 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronsUpDown className="h-4 w-4 opacity-70" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="p-1 w-(--radix-popover-trigger-width) max-h-64 overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div id={listId} role="listbox">
          {rowCount === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              {value.trim() ? "No matches — keep typing to add it" : "Type to search"}
            </p>
          ) : (
            <>
              {filtered.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                    highlight === i ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", value === opt ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{opt}</span>
                </button>
              ))}
              {showAddRow && (
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === filtered.length}
                  onMouseEnter={() => setHighlight(filtered.length)}
                  onClick={() => pick(value.trim())}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground",
                    highlight === filtered.length
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60",
                  )}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Use "<span className="font-medium">{value.trim()}</span>"
                  </span>
                  <span className="ml-auto text-xs shrink-0">{emptyHint}</span>
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
