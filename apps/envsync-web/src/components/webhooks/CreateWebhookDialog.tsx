import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  GlobeLock,
  MessageCircle,
  Search,
  Building2,
  AppWindow,
  ShieldAlert,
  Database,
  Globe,
  Users,
  Variable,
  Lock,
  Layers,
  Key,
  KeyRound,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WEBHOOK_EVENT_CATEGORIES } from "@/constants";
import type { App } from "@/constants";

export const WEBHOOK_TYPES = [
  {
    value: "CUSTOM",
    label: "HTTP/HTTPS",
    color: "bg-yellow-500/20 hover:bg-yellow-500/50 border-yellow-700",
    activeColor: "bg-yellow-500/30 border-yellow-500 ring-2 ring-yellow-500/40",
    icon: GlobeLock,
    accent: "text-yellow-400",
  },
  {
    value: "SLACK",
    label: "Slack",
    color: "bg-fuchsia-500/20 hover:bg-fuchsia-500/50 border-fuchsia-700",
    activeColor:
      "bg-fuchsia-500/30 border-fuchsia-500 ring-2 ring-fuchsia-500/40",
    icon: MessageCircle,
    accent: "text-fuchsia-400",
  },
  {
    value: "DISCORD",
    label: "Discord",
    color: "bg-indigo-500/20 hover:bg-indigo-500/50 border-indigo-700",
    activeColor:
      "bg-indigo-500/30 border-indigo-500 ring-2 ring-indigo-500/40",
    icon: MessageCircle,
    accent: "text-indigo-400",
  },
] as const;

export const LINKED_TO_OPTIONS = [
  { value: "org", label: "Organization", icon: Building2 },
  { value: "app", label: "Application", icon: AppWindow },
] as const;

const CATEGORY_ICONS: Record<string, typeof ShieldAlert> = {
  roles: ShieldAlert,
  applications: Database,
  organization: Globe,
  users: Users,
  environment: Variable,
  secrets: Lock,
  env_types: Layers,
  api_keys: Key,
  gpg_keys: KeyRound,
  certificates: ShieldCheck,
  audit: Activity,
};

export interface WebhookFormData {
  name: string;
  event_types: string[];
  url: string;
  webhook_type: "CUSTOM" | "SLACK" | "DISCORD";
  app_id: string | null;
  linked_to: "org" | "app";
}

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: App[];
  applicationsLoading: boolean;
  applicationsError: boolean;
  isCreating: boolean;
  webhookData: WebhookFormData;
  onWebhookDataChange: (data: WebhookFormData) => void;
  onEventToggle: (eventType: string) => void;
  onCategoryToggle: (categoryName: string) => void;
  onSubcategoryToggle: (categoryName: string, subcategoryName: string) => void;
  onCreate: () => void;
}

export function CreateWebhookDialog({
  open,
  onOpenChange,
  applications,
  applicationsLoading,
  applicationsError,
  isCreating,
  webhookData,
  onWebhookDataChange,
  onEventToggle,
  onCategoryToggle,
  onSubcategoryToggle,
  onCreate,
}: CreateWebhookDialogProps) {
  const [eventSearch, setEventSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string>("");

  // Completion checks
  const isBasicInfoComplete =
    webhookData.name.trim() !== "" && webhookData.url.trim() !== "";
  const isConfigComplete =
    webhookData.webhook_type !== undefined &&
    webhookData.linked_to !== undefined &&
    (webhookData.linked_to === "org" || webhookData.app_id !== null);
  const isEventsComplete = webhookData.event_types.length > 0;

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!eventSearch.trim()) return WEBHOOK_EVENT_CATEGORIES;

    const query = eventSearch.toLowerCase();
    return WEBHOOK_EVENT_CATEGORIES.map((category) => {
      const categoryMatches = category.label.toLowerCase().includes(query);
      const filteredSubcategories = category.subcategories.map((sub) => {
        const subMatches = sub.label.toLowerCase().includes(query);
        const filteredEvents = sub.events.filter(
          (event) =>
            categoryMatches ||
            subMatches ||
            event.label.toLowerCase().includes(query) ||
            event.value.toLowerCase().includes(query)
        );
        return { ...sub, events: filteredEvents };
      }).filter((sub) => sub.events.length > 0);

      const filteredEvents = category.events.filter(
        (event) =>
          categoryMatches ||
          event.label.toLowerCase().includes(query) ||
          event.value.toLowerCase().includes(query)
      );

      return {
        ...category,
        subcategories: filteredSubcategories,
        events: filteredEvents,
      };
    }).filter((cat) => cat.events.length > 0);
  }, [eventSearch]);

  // Count selected events per category
  const getCategorySelectedCount = (categoryName: string) => {
    const category = WEBHOOK_EVENT_CATEGORIES.find(
      (c) => c.name === categoryName
    );
    if (!category) return { selected: 0, total: 0 };
    const total = category.events.length;
    const selected = category.events.filter((e) =>
      webhookData.event_types.includes(e.value)
    ).length;
    return { selected, total };
  };

  const isCategoryAllSelected = (categoryName: string) => {
    const { selected, total } = getCategorySelectedCount(categoryName);
    return total > 0 && selected === total;
  };

  // Summary texts
  const basicInfoSummary =
    isBasicInfoComplete
      ? `${webhookData.name} \u2192 ${webhookData.url.length > 30 ? webhookData.url.slice(0, 30) + "..." : webhookData.url}`
      : "Incomplete";

  const webhookTypeLabel =
    WEBHOOK_TYPES.find((t) => t.value === webhookData.webhook_type)?.label ||
    webhookData.webhook_type;
  const scopeLabel =
    webhookData.linked_to === "org" ? "Organization" : "Application";
  const appName =
    webhookData.linked_to === "app" && webhookData.app_id
      ? applications?.find((a) => a.id === webhookData.app_id)?.name ||
        "Selected"
      : null;
  const configSummary = `${webhookTypeLabel} \u00b7 ${scopeLabel}${appName ? ` \u00b7 ${appName}` : ""}`;

  const eventsSummary =
    webhookData.event_types.length > 0
      ? `${webhookData.event_types.length} event${webhookData.event_types.length !== 1 ? "s" : ""} selected`
      : "No events selected";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto hide-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Webhook</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure your webhook step by step using the sections below.
          </DialogDescription>
        </DialogHeader>

        <Accordion
          type="multiple"
          defaultValue={["basic-info"]}
          className="w-full"
        >
          {/* Section 1: Basic Information */}
          <AccordionItem value="basic-info" className="border-gray-700">
            <AccordionTrigger className="hover:no-underline px-1">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full border text-xs font-bold",
                    isBasicInfoComplete
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-gray-700 border-gray-600 text-gray-400"
                  )}
                >
                  {isBasicInfoComplete ? (
                    <Check className="size-3.5" />
                  ) : (
                    "1"
                  )}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-semibold text-white">
                    Basic Information
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      isBasicInfoComplete ? "text-gray-400" : "text-gray-500"
                    )}
                  >
                    {basicInfoSummary}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-name" className="text-white">
                    Name *
                  </Label>
                  <Input
                    id="webhook-name"
                    placeholder="My Webhook"
                    value={webhookData.name}
                    onChange={(e) =>
                      onWebhookDataChange({
                        ...webhookData,
                        name: e.target.value,
                      })
                    }
                    className="bg-gray-900 border-gray-700 text-white"
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url" className="text-white">
                    Payload URL *
                  </Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder="https://hook.url/webhook"
                    value={webhookData.url}
                    onChange={(e) =>
                      onWebhookDataChange({
                        ...webhookData,
                        url: e.target.value,
                      })
                    }
                    className="bg-gray-900 border-gray-700 text-white"
                    disabled={isCreating}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: Webhook Configuration */}
          <AccordionItem value="config" className="border-gray-700">
            <AccordionTrigger className="hover:no-underline px-1">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full border text-xs font-bold",
                    isConfigComplete
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-gray-700 border-gray-600 text-gray-400"
                  )}
                >
                  {isConfigComplete ? <Check className="size-3.5" /> : "2"}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-semibold text-white">
                    Webhook Configuration
                  </span>
                  <span className="text-xs text-gray-400">
                    {configSummary}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <div className="space-y-5">
                {/* Webhook Type Cards */}
                <div className="space-y-2">
                  <Label className="text-white">Webhook Type *</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {WEBHOOK_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isActive =
                        webhookData.webhook_type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            onWebhookDataChange({
                              ...webhookData,
                              webhook_type:
                                type.value as WebhookFormData["webhook_type"],
                            })
                          }
                          disabled={isCreating}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer transition-all",
                            isActive ? type.activeColor : type.color
                          )}
                        >
                          <Icon className={cn("size-5", type.accent)} />
                          <span className="text-sm font-medium text-white">
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scope Cards */}
                <div className="space-y-2">
                  <Label className="text-white">Scope *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {LINKED_TO_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isActive =
                        webhookData.linked_to === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            onWebhookDataChange({
                              ...webhookData,
                              linked_to:
                                option.value as WebhookFormData["linked_to"],
                              app_id:
                                option.value === "org"
                                  ? null
                                  : webhookData.app_id,
                            })
                          }
                          disabled={isCreating}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            isActive
                              ? "bg-indigo-500/20 border-indigo-500 ring-2 ring-indigo-500/40"
                              : "bg-gray-900 border-gray-700 hover:bg-gray-800"
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-5",
                              isActive ? "text-indigo-400" : "text-gray-400"
                            )}
                          />
                          <span className="text-sm font-medium text-white">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional App Selector */}
                {webhookData.linked_to === "app" && (
                  <div className="space-y-2">
                    <Label htmlFor="webhook-app" className="text-white">
                      Application *
                    </Label>
                    <Select
                      value={webhookData.app_id || ""}
                      onValueChange={(value) =>
                        onWebhookDataChange({
                          ...webhookData,
                          app_id: value || null,
                        })
                      }
                      disabled={isCreating || applicationsLoading}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                        <SelectValue placeholder="Select an application" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 max-h-60 overflow-y-auto">
                        {applicationsLoading ? (
                          <SelectItem
                            value=""
                            disabled
                            className="text-gray-400"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              <span>Loading applications...</span>
                            </div>
                          </SelectItem>
                        ) : applications && applications.length > 0 ? (
                          applications.map((app) => (
                            <SelectItem
                              key={app.id}
                              value={app.id}
                              className="text-white"
                            >
                              <div className="flex flex-col py-1">
                                <span className="font-medium">{app.name}</span>
                                <span className="text-xs text-gray-400 font-mono">
                                  ID: {app.id}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem
                            value=""
                            disabled
                            className="text-gray-400"
                          >
                            No applications found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {applicationsError && (
                      <p className="text-xs text-red-400">
                        Failed to load applications. Please try again.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: Event Subscriptions */}
          <AccordionItem value="events" className="border-gray-700">
            <AccordionTrigger className="hover:no-underline px-1">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full border text-xs font-bold",
                    isEventsComplete
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-gray-700 border-gray-600 text-gray-400"
                  )}
                >
                  {isEventsComplete ? <Check className="size-3.5" /> : "3"}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-semibold text-white">
                    Event Subscriptions
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      isEventsComplete ? "text-gray-400" : "text-gray-500"
                    )}
                  >
                    {eventsSummary}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <div className="space-y-4">
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                  <Input
                    placeholder="Search events..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white pl-9"
                    disabled={isCreating}
                  />
                </div>

                {/* Category Cards Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {filteredCategories.map((category) => {
                    const { selected, total } = getCategorySelectedCount(
                      category.name
                    );
                    const allSelected = isCategoryAllSelected(category.name);
                    const CategoryIcon =
                      CATEGORY_ICONS[category.name] || Activity;
                    const isExpanded = expandedCategory === category.name;

                    return (
                      <div
                        key={category.name}
                        className={cn(
                          "rounded-lg border transition-all",
                          isExpanded
                            ? "border-indigo-500/50 bg-gray-900/80 col-span-2"
                            : "border-gray-700 bg-gray-900/40 hover:bg-gray-900/60"
                        )}
                      >
                        {/* Category Header */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer"
                          onClick={() =>
                            setExpandedCategory(
                              isExpanded ? "" : category.name
                            )
                          }
                        >
                          <div className="flex items-center gap-2.5">
                            <CategoryIcon className="size-4 text-gray-400" />
                            <span className="text-sm font-medium text-white">
                              {category.label}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                selected > 0
                                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                  : "bg-gray-700 text-gray-400"
                              )}
                            >
                              {selected}/{total}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCategoryToggle(category.name);
                              }}
                              disabled={isCreating}
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                allSelected
                                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                                  : "bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-gray-500"
                              )}
                            >
                              {allSelected ? "Deselect all" : "Select all"}
                            </button>
                          </div>
                        </div>

                        {/* Expanded: Subcategories + Events */}
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50 pt-3">
                            {category.subcategories.map((subcategory) => {
                              const subEvents = subcategory.events;
                              if (subEvents.length === 0) return null;
                              const subAllSelected = subEvents.every((e) =>
                                webhookData.event_types.includes(e.value)
                              );

                              return (
                                <div
                                  key={subcategory.name}
                                  className="space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={subAllSelected}
                                        onCheckedChange={() =>
                                          onSubcategoryToggle(
                                            category.name,
                                            subcategory.name
                                          )
                                        }
                                        disabled={isCreating}
                                        className="border-gray-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                                      />
                                      <span className="text-xs font-medium text-gray-300">
                                        {subcategory.label}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-6 grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {subEvents.map((event) => (
                                      <label
                                        key={event.value}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <Checkbox
                                          checked={webhookData.event_types.includes(
                                            event.value
                                          )}
                                          onCheckedChange={() =>
                                            onEventToggle(event.value)
                                          }
                                          disabled={isCreating}
                                          className="border-gray-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                                        />
                                        <span className="text-xs text-gray-400">
                                          {event.label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {filteredCategories.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-4">
                    No events match your search.
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 4: Review & Create */}
          <AccordionItem value="review" className="border-gray-700">
            <AccordionTrigger className="hover:no-underline px-1">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full border text-xs font-bold",
                    isBasicInfoComplete && isConfigComplete && isEventsComplete
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-gray-700 border-gray-600 text-gray-400"
                  )}
                >
                  {isBasicInfoComplete &&
                  isConfigComplete &&
                  isEventsComplete ? (
                    <Check className="size-3.5" />
                  ) : (
                    "4"
                  )}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-semibold text-white">
                    Review & Create
                  </span>
                  <span className="text-xs text-gray-400">
                    Confirm your webhook configuration
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <div className="space-y-4">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-900/60 border border-gray-700 p-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      Name
                    </span>
                    <p className="text-sm text-white font-medium">
                      {webhookData.name || (
                        <span className="text-gray-500 italic">Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      Payload URL
                    </span>
                    <p className="text-sm text-white font-mono truncate">
                      {webhookData.url || (
                        <span className="text-gray-500 italic font-sans">
                          Not set
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      Type
                    </span>
                    <div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          WEBHOOK_TYPES.find(
                            (t) => t.value === webhookData.webhook_type
                          )?.color
                        )}
                      >
                        {webhookTypeLabel}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      Scope
                    </span>
                    <p className="text-sm text-white">
                      {scopeLabel}
                      {appName && (
                        <span className="text-gray-400"> &middot; {appName}</span>
                      )}
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      Events ({webhookData.event_types.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {webhookData.event_types.length > 0 ? (
                        webhookData.event_types.map((eventValue) => {
                          const eventLabel = WEBHOOK_EVENT_CATEGORIES.flatMap(
                            (c) => c.events
                          ).find((e) => e.value === eventValue)?.label;
                          return (
                            <Badge
                              key={eventValue}
                              variant="secondary"
                              className="text-[10px] bg-gray-700 text-gray-300"
                            >
                              {eventLabel || eventValue}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-sm text-gray-500 italic">
                          No events selected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="text-white border-gray-600 hover:bg-gray-700"
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onCreate}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white"
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Webhook"
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
