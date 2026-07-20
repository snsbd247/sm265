import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchOption = {
  value: string;
  label: string;
  hint?: string;
  keywords?: string;
};

type Props = {
  options: SearchOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  empty?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Called when user picks an option; useful for POS-style add-and-clear. */
  clearOnSelect?: boolean;
};

/**
 * Command-palette style searchable single-select. Replaces plain <Select>
 * anywhere long lists (products, customers, suppliers) need incremental search.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "বাছাই করুন",
  searchPlaceholder = "খুঁজুন...",
  empty = "কিছু পাওয়া যায়নি",
  disabled,
  className,
  triggerClassName,
  clearOnSelect,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", triggerClassName)}
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                <span>{selected.label}</span>
                {selected.hint && (
                  <span className="ml-1 text-xs text-muted-foreground">{selected.hint}</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[--radix-popover-trigger-width] p-0", className)}
        align="start"
      >
        <Command
          filter={(v, search) => {
            const opt = options.find((o) => o.value === v);
            if (!opt) return 0;
            const hay = `${opt.label} ${opt.hint ?? ""} ${opt.keywords ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <div className="flex items-center border-b px-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput placeholder={searchPlaceholder} className="border-0 focus:ring-0" />
          </div>
          <CommandList className="max-h-72">
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={(v) => {
                    onChange(v);
                    if (!clearOnSelect) setOpen(false);
                    else setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{o.label}</div>
                    {o.hint && (
                      <div className="truncate text-xs text-muted-foreground">{o.hint}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
