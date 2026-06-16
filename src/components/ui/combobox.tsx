import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyHint?: string;
  className?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyHint = "Press Enter to add",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const normalized = query.trim();
  const lowerQuery = normalized.toLowerCase();
  const exactMatch = options.some((o) => o.toLowerCase() === lowerQuery);

  const commit = (val: string) => {
    const v = val.trim();
    if (!v) return;
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width]"
        align="start"
      >
        <Command
          shouldFilter={true}
          onKeyDown={(e) => {
            if (e.key === "Enter" && normalized && !exactMatch) {
              e.preventDefault();
              commit(normalized);
            }
          }}
        >
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {normalized ? (
                <button
                  type="button"
                  onClick={() => commit(normalized)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Add <span className="font-medium">"{normalized}"</span>
                  </span>
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Type to search or add
                </span>
              )}
            </CommandEmpty>
            {options.length > 0 && (
              <CommandGroup heading="Recent">
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => commit(opt)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === opt ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt}
                  </CommandItem>
                ))}
                {normalized && !exactMatch && (
                  <CommandItem
                    value={`__add__${normalized}`}
                    onSelect={() => commit(normalized)}
                    className="text-muted-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add "{normalized}"
                    <span className="ml-auto text-xs">{emptyHint}</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
