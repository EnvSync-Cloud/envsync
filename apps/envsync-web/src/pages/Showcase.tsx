import { useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Settings, Users, Database, Key, Shield, Bell, Zap, Globe, Terminal as TerminalIcon } from "lucide-react"

import {
  CropMarkFrame,
  SectionHeading,
  StatCallout,
  Terminal,
  TabPills,
  BeamCard,
  SplitPanel,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@/components/ui/menubar"
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { toast } from "@/components/ui/sonner"

function ThemeToggleCorner() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="fixed top-4 right-4 z-50 inline-flex items-center justify-center w-10 h-10 rounded-full border border-border text-foreground hover:opacity-95 transition-opacity"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="text-h2 font-medium">{title}</h2>
      {children}
    </section>
  )
}

export default function Showcase() {
  const [tabActive, setTabActive] = useState("overview")
  const [progress] = useState(65)

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <ThemeToggleCorner />

      <div className="mx-auto max-w-6xl px-6 py-12 space-y-16">
        {/* Header */}
        <header className="text-center space-y-4">
          <span className="font-mono text-mono-label text-accent-ink">DEV ONLY</span>
          <h1 className="text-display font-medium">Design System Showcase</h1>
          <p className="text-lead text-muted-foreground max-w-2xl mx-auto">
            Visual reference for all primitives, tokens, and shadcn components.
            Toggle light/dark with the button top-right.
          </p>
        </header>

        <Separator />

        {/* 1. Color Swatches */}
        <Section title="Color Tokens">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "background", className: "bg-background text-foreground border border-border" },
              { label: "card", className: "bg-card text-card-foreground border border-border" },
              { label: "primary", className: "bg-primary text-primary-foreground" },
              { label: "secondary", className: "bg-secondary text-secondary-foreground border border-border" },
              { label: "muted", className: "bg-muted text-muted-foreground" },
              { label: "accent", className: "bg-accent text-accent-foreground border border-border" },
              { label: "destructive", className: "bg-destructive text-destructive-foreground" },
              { label: "accent-ink", className: "bg-background text-accent-ink border border-border" },
            ].map((swatch) => (
              <div key={swatch.label} className={`rounded-lg p-4 ${swatch.className}`}>
                <p className="text-sm font-medium">{swatch.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[
              { label: "accent-tint", className: "bg-accent-tint/20 text-foreground border border-accent-tint/30" },
              { label: "accent-surface", className: "bg-accent-surface text-foreground border border-border" },
              { label: "accent-outline", className: "bg-background text-foreground border border-accent-outline/35" },
              { label: "status-warning", className: "bg-status-warning text-white" },
              { label: "hero-text", className: "bg-primary text-hero-text" },
              { label: "tertiary", className: "bg-background text-tertiary border border-border" },
              { label: "primary-hover", className: "bg-primary-hover text-primary-foreground" },
              { label: "border", className: "bg-background text-foreground border-2 border-border" },
            ].map((swatch) => (
              <div key={swatch.label} className={`rounded-lg p-4 ${swatch.className}`}>
                <p className="text-sm font-medium">{swatch.label}</p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        {/* 2. Typography Scale */}
        <Section title="Typography Scale">
          <div className="space-y-4">
            <p className="text-display font-medium">Display — 56px/500</p>
            <p className="text-h1 font-medium">H1 — 48px/500</p>
            <p className="text-h2 font-medium">H2 — 32px/500</p>
            <p className="text-h3 font-medium">H3 — 18px/500</p>
            <p className="text-lead">Lead — 19.2px/400</p>
            <p className="text-base">Body — 16px/400. The quick brown fox jumps over the lazy dog.</p>
            <p className="text-sm text-muted-foreground">Body/sm — 14px/400. Secondary information text.</p>
            <p className="text-xs text-muted-foreground">Caption — 12px/400. Meta and annotations.</p>
            <p className="font-mono text-mono-label text-accent-ink">Mono/label — 13px/400. Technical labels.</p>
            <p className="font-mono text-sm">Mono/code — 14px/400. Code blocks and terminal.</p>
          </div>
        </Section>

        <Separator />

        {/* 3. Buttons */}
        <Section title="Buttons">
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Settings"><Settings className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">States</p>
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </div>
        </Section>

        <Separator />

        {/* 4. Cards */}
        <Section title="Cards">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Hairline Card</CardTitle>
                <CardDescription>Default card with border-only depth.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No shadow, 1px hairline border. The foundation of the design system.</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">Action</Button>
              </CardFooter>
            </Card>

            <Card className="border-accent-tint/30 bg-accent-surface">
              <CardHeader>
                <CardTitle>Tint Card</CardTitle>
                <CardDescription>Accent-tinted surface variant.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Uses accent-surface background with accent-tint border.</p>
              </CardContent>
            </Card>

            <CropMarkFrame className="rounded-lg bg-card p-6 border border-border">
              <CardTitle className="mb-2">Blueprint Card</CardTitle>
              <CardDescription>Crop-mark corner ticks.</CardDescription>
              <p className="text-sm text-muted-foreground mt-2">Four corner L-shapes mark the content boundary.</p>
            </CropMarkFrame>
          </div>
        </Section>

        <Separator />

        {/* 5. CropMarkFrame */}
        <Section title="CropMarkFrame">
          <div className="grid md:grid-cols-2 gap-6">
            <CropMarkFrame className="rounded-lg bg-card p-8 border border-border">
              <p className="text-sm text-muted-foreground">Default crop marks with border-input color.</p>
            </CropMarkFrame>
            <CropMarkFrame color="hsl(var(--primary))" className="rounded-lg bg-card p-8 border border-border">
              <p className="text-sm text-muted-foreground">Custom accent-colored crop marks.</p>
            </CropMarkFrame>
          </div>
        </Section>

        <Separator />

        {/* 6. SectionHeading */}
        <Section title="SectionHeading">
          <SectionHeading
            eyebrow="FEATURES"
            title="Built for Scale"
            description="A centered section heading with eyebrow, title, and description. The backbone of marketing-style content sections."
          />
          <SectionHeading
            align="left"
            eyebrow="OVERVIEW"
            title="Left-Aligned Heading"
            description="Same component, left-aligned variant for different layout contexts."
          />
        </Section>

        <Separator />

        {/* 7. StatCallout */}
        <Section title="StatCallout">
          <div className="grid md:grid-cols-3 gap-4">
            <StatCallout eyebrow="UPTIME" numeral="99.99%" body="Enterprise-grade reliability" />
            <StatCallout eyebrow="SECRETS" numeral="2.4M+" body="Managed across teams" />
            <StatCallout eyebrow="INTEGRATIONS" numeral="28+" body="Native platform connections" />
          </div>
        </Section>

        <Separator />

        {/* 8. Terminal */}
        <Section title="Terminal">
          <Terminal
            title="envsync — terminal demo"
            lines={[
              { type: "cmd", text: "envsync pull --env production" },
              { type: "info", text: "Connecting to api.envsync.cloud..." },
              { type: "success", text: "Pulled 24 variables for my-app/production" },
              { type: "cmd", text: "envsync push --env staging" },
              { type: "warn", text: "3 variables will be overwritten" },
              { type: "success", text: "Pushed 24 variables to my-app/staging" },
              { type: "info", text: "Change request #142 created — awaiting approval" },
            ]}
          />
        </Section>

        <Separator />

        {/* 9. TabPills */}
        <Section title="TabPills">
          <TabPills
            tabs={[
              { id: "overview", label: "Overview", icon: Globe },
              { id: "secrets", label: "Secrets", icon: Key },
              { id: "team", label: "Team", icon: Users },
              { id: "settings", label: "Settings", icon: Settings },
            ]}
            active={tabActive}
            onChange={setTabActive}
          />
          <p className="text-sm text-muted-foreground mt-2">Active: {tabActive}</p>
        </Section>

        <Separator />

        {/* 10. BeamCard */}
        <Section title="BeamCard">
          <div className="grid md:grid-cols-2 gap-6">
            <BeamCard>
              <CardTitle className="mb-2">Hover Me</CardTitle>
              <p className="text-sm text-muted-foreground">The conic-gradient beam border appears on hover.</p>
            </BeamCard>
            <BeamCard active>
              <CardTitle className="mb-2">Always Active</CardTitle>
              <p className="text-sm text-muted-foreground">The beam border is always visible when active prop is true.</p>
            </BeamCard>
          </div>
        </Section>

        <Separator />

        {/* 11. SplitPanel */}
        <Section title="SplitPanel">
          <SplitPanel
            leftSlot={
              <div className="space-y-4">
                <h3 className="text-h3 font-medium">Hairline Side</h3>
                <p className="text-sm text-muted-foreground">The left panel uses card background with hairline border. Content goes here.</p>
                <Button variant="outline" size="sm">Learn More</Button>
              </div>
            }
            rightSlot={
              <>
                <h3 className="text-h3 font-medium">Accent Side</h3>
                <p className="text-sm opacity-90">The right panel uses primary background with hero-text color. Perfect for CTAs.</p>
                <Button variant="secondary" size="sm" className="w-fit">Get Started</Button>
              </>
            }
          />
        </Section>

        <Separator />

        {/* 12. Contrast Verification */}
        <Section title="Contrast Verification">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-white p-6 border border-border">
              <p className="text-accent-ink font-medium mb-2">accent-ink on white</p>
              <p className="text-accent-ink text-sm">This text uses accent-ink on a white background. Should be ≥4.5:1 contrast.</p>
            </div>
            <div className="rounded-lg bg-[#0C0E13] p-6">
              <p className="text-accent-ink font-medium mb-2">accent-ink on dark</p>
              <p className="text-accent-ink text-sm">This text uses accent-ink on a dark background. Should be ≥4.5:1 contrast.</p>
            </div>
            <div className="rounded-lg bg-primary p-6">
              <p className="text-primary-foreground font-medium mb-2">primary-foreground on primary</p>
              <p className="text-primary-foreground text-sm">This text uses primary-foreground on primary background. Should be ≥4.5:1.</p>
            </div>
            <div className="rounded-lg bg-destructive p-6">
              <p className="text-destructive-foreground font-medium mb-2">destructive-foreground on destructive</p>
              <p className="text-destructive-foreground text-sm">This text uses destructive-foreground on destructive. Should be ≥4.5:1.</p>
            </div>
          </div>
        </Section>

        <Separator />

        {/* 13. shadcn Components */}
        <Section title="shadcn Components">
          <div className="space-y-12">

            {/* Input */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Input</h3>
              <div className="max-w-sm space-y-3">
                <Input placeholder="Default input" />
                <Input placeholder="Disabled input" disabled />
              </div>
            </div>

            {/* Textarea */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Textarea</h3>
              <Textarea placeholder="Type your message here..." className="max-w-sm" />
            </div>

            {/* Select */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Select</h3>
              <Select>
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Select an environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Badge */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Badge</h3>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Tabs</h3>
              <Tabs defaultValue="account" className="max-w-md">
                <TabsList>
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="password">Password</TabsTrigger>
                </TabsList>
                <TabsContent value="account" className="p-4 border border-border rounded-lg mt-2">
                  <p className="text-sm text-muted-foreground">Account settings content.</p>
                </TabsContent>
                <TabsContent value="password" className="p-4 border border-border rounded-lg mt-2">
                  <p className="text-sm text-muted-foreground">Password settings content.</p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Dialog */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Dialog</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>This action cannot be undone.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* AlertDialog */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Alert Dialog</h3>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Project</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete the project and all its secrets.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* DropdownMenu */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Dropdown Menu</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Open Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Popover */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Popover</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Open Popover</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Dimensions</h4>
                    <p className="text-sm text-muted-foreground">Set the dimensions for the layer.</p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tooltip */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Tooltip</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Hover Me</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is a tooltip</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Sheet */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Sheet</h3>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open Sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Edit profile</SheetTitle>
                    <SheetDescription>Make changes to your profile here.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </div>

            {/* Drawer */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Drawer</h3>
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline">Open Drawer</Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Are you sure?</DrawerTitle>
                    <DrawerDescription>This action cannot be undone.</DrawerDescription>
                  </DrawerHeader>
                  <DrawerFooter>
                    <Button>Submit</Button>
                    <DrawerClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>

            {/* HoverCard */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Hover Card</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="link">@envsync</Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">@envsync</h4>
                    <p className="text-sm text-muted-foreground">CLI-first secrets and config delivery for dev, staging, CI, and production.</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>

            {/* ContextMenu */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Context Menu</h3>
              <ContextMenu>
                <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Right-click here
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem>Copy</ContextMenuItem>
                  <ContextMenuItem>Paste</ContextMenuItem>
                  <ContextMenuItem>Delete</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>

            {/* Table */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Table</h3>
              <Table>
                <TableCaption>A list of your environment variables.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono">DATABASE_URL</TableCell>
                    <TableCell className="font-mono text-muted-foreground">••••••••</TableCell>
                    <TableCell><Badge variant="secondary">production</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">API_KEY</TableCell>
                    <TableCell className="font-mono text-muted-foreground">••••••••</TableCell>
                    <TableCell><Badge variant="secondary">staging</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Accordion */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Accordion</h3>
              <Accordion type="single" collapsible className="max-w-md">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Is it accessible?</AccordionTrigger>
                  <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Is it styled?</AccordionTrigger>
                  <AccordionContent>Yes. It comes with default styles that match the design system.</AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Avatar */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Avatar</h3>
              <div className="flex gap-3">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>ES</AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Checkbox */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Checkbox</h3>
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" />
                <Label htmlFor="terms">Accept terms and conditions</Label>
              </div>
            </div>

            {/* Switch */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Switch</h3>
              <div className="flex items-center space-x-2">
                <Switch id="airplane-mode" />
                <Label htmlFor="airplane-mode">Airplane Mode</Label>
              </div>
            </div>

            {/* RadioGroup */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Radio Group</h3>
              <RadioGroup defaultValue="comfortable">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="default" id="r1" />
                  <Label htmlFor="r1">Default</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="comfortable" id="r2" />
                  <Label htmlFor="r2">Comfortable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="compact" id="r3" />
                  <Label htmlFor="r3">Compact</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Slider */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Slider</h3>
              <Slider defaultValue={[50]} max={100} step={1} className="max-w-sm" />
            </div>

            {/* Progress */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Progress</h3>
              <Progress value={progress} className="max-w-sm" />
            </div>

            {/* Skeleton */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Skeleton</h3>
              <div className="flex items-center space-x-4 max-w-sm">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            </div>

            {/* Toggle & ToggleGroup */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Toggle & Toggle Group</h3>
              <div className="flex gap-3">
                <Toggle>Bold</Toggle>
                <ToggleGroup type="multiple">
                  <ToggleGroupItem value="bold">B</ToggleGroupItem>
                  <ToggleGroupItem value="italic">I</ToggleGroupItem>
                  <ToggleGroupItem value="underline">U</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Collapsible */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Collapsible</h3>
              <Collapsible className="max-w-sm">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">@peduarte starred 3 repositories</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <div className="rounded-md border border-border px-4 py-2 text-sm">@radix-ui/primitives</div>
                  <div className="rounded-md border border-border px-4 py-2 text-sm">@radix-ui/colors</div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Command */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Command</h3>
              <Command className="max-w-sm rounded-lg border border-border">
                <CommandInput placeholder="Type a command..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup heading="Suggestions">
                    <CommandItem>Calendar</CommandItem>
                    <CommandItem>Search</CommandItem>
                    <CommandItem>Settings</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Separator */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Separator</h3>
              <div className="max-w-sm">
                <div className="flex items-center gap-4">
                  <span className="text-sm">Left</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-sm">Right</span>
                </div>
                <Separator className="my-4" />
                <span className="text-sm text-muted-foreground">Horizontal separator above</span>
              </div>
            </div>

            {/* ScrollArea */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Scroll Area</h3>
              <ScrollArea className="h-32 w-64 rounded-md border border-border p-4">
                <div className="space-y-2">
                  {Array.from({ length: 20 }, (_, i) => (
                    <p key={i} className="text-sm">Scroll item {i + 1}</p>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Resizable */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Resizable</h3>
              <ResizablePanelGroup direction="horizontal" className="max-w-md rounded-lg border border-border">
                <ResizablePanel defaultSize={50}>
                  <div className="flex h-32 items-center justify-center p-4">
                    <span className="text-sm text-muted-foreground">Panel A</span>
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={50}>
                  <div className="flex h-32 items-center justify-center p-4">
                    <span className="text-sm text-muted-foreground">Panel B</span>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>

            {/* Toast */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Toast / Sonner</h3>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => toast("Event has been created")}>Show Toast</Button>
                <Button variant="outline" onClick={() => toast.success("Success!", { description: "Your changes have been saved." })}>Success Toast</Button>
                <Button variant="outline" onClick={() => toast.error("Error!", { description: "Something went wrong." })}>Error Toast</Button>
              </div>
            </div>

            {/* Menubar */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Menubar</h3>
              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger>File</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem>New Tab</MenubarItem>
                    <MenubarItem>New Window</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem>Share</MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                  <MenubarTrigger>Edit</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem>Undo</MenubarItem>
                    <MenubarItem>Redo</MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
            </div>

            {/* NavigationMenu */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Navigation Menu</h3>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="p-4 w-[300px]">
                        <p className="text-sm text-muted-foreground">Quick start guide for EnvSync.</p>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Documentation</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="p-4 w-[300px]">
                        <p className="text-sm text-muted-foreground">API reference and guides.</p>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* Pagination */}
            <div>
              <h3 className="text-h3 font-medium mb-4">Pagination</h3>
              <Pagination>
                <PaginationContent>
                  <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                  <PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem>
                  <PaginationItem><PaginationLink href="#" isActive>2</PaginationLink></PaginationItem>
                  <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
                  <PaginationItem><PaginationNext href="#" /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>

          </div>
        </Section>
      </div>
    </div>
  )
}
