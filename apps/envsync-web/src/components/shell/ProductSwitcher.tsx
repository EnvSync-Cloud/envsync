import { Building2, Check, ChevronsUpDown, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRODUCTS, type ProductId, productHomeHref } from "@/lib/shell-context";
import { cn } from "@/lib/utils";

const PRODUCT_ICONS = {
  secrets: KeyRound,
  certificates: ShieldCheck,
  organization: Building2,
} as const;

interface ProductSwitcherProps {
  expanded: boolean;
  product: ProductId;
  projectIds: string[];
}

export function ProductSwitcher({ expanded, product, projectIds }: ProductSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const active = useMemo(
    () => PRODUCTS.find((item) => item.id === product) ?? PRODUCTS[0],
    [product],
  );
  const ActiveIcon = PRODUCT_ICONS[active.id];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="product-switcher-trigger"
          className={cn(
            "flex w-full items-center rounded-2xl border border-border bg-secondary text-left text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5",
            expanded ? "gap-2 px-3 py-2" : "justify-center p-2",
          )}
          title={active.name}
        >
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ActiveIcon className="size-3.5" />
          </span>
          {expanded && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{active.name}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-[280px] border-border bg-popover p-0">
        <Command className="bg-transparent text-foreground">
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup heading="Products">
              {PRODUCTS.map((item) => {
                const Icon = PRODUCT_ICONS[item.id];
                return (
                  <CommandItem
                    key={item.id}
                    data-testid={`product-switcher-item-${item.id}`}
                    value={item.name}
                    onSelect={() => {
                      setOpen(false);
                      navigate(productHomeHref(item.id, projectIds));
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-muted"
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.name}</span>
                    {item.id === product && <Check className="size-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
