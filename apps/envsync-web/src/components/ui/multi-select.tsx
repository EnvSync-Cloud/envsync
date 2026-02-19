"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { useOptional } from "@/hooks/useOptional";

export interface MultiSelectProps {
  items?: { label: React.ReactNode; value: string }[];
  className?: string;
  enableSearch?: boolean;
  placeholder?: string;
  onChange?: (values: string[]) => void;
  value?: string[];
  disabled?: boolean;
}

export function MultiSelect({
  items = [],
  className,
  enableSearch,
  placeholder,
  disabled,
  value,
  onChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useOptional({
    value,
    setValue: onChange,
    defaultValue: [],
  });

  const selectedItems = items.filter((item) =>
    selectedValues.includes(item.value)
  );

  const handleSelect = (value: string) => {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value]
    );
  };

  const handleRemove = (value: string) => {
    setSelectedValues(selectedValues.filter((item) => item !== value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-10 h-auto p-2",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedItems.length > 0 ? (
              selectedItems.map((item) => (
                <Badge
                  key={item.value}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {item.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-4 p-0 hover:bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(item.value);
                    }}
                  >
                    <X className="size-3" />
                    <span className="sr-only">Remove {item.label}</span>
                  </Button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] bg-gray-900 p-0"
        align="start"
      >
        <Command>
          {enableSearch && <CommandInput placeholder={placeholder} />}
          <CommandList className="bg-gray-900">
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={() => handleSelect(item.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      selectedValues.includes(item.value)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
