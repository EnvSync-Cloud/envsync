import { Check, ChevronsUpDown, FolderKanban, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthContext } from "@/contexts/auth";
import { appDetailPath, projectCreatePath, projectsPath } from "@/lib/app-routes";
import { writeLastProjectId } from "@/lib/shell-context";
import { cn } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
}

interface ProjectSwitcherProps {
  expanded: boolean;
  appId: string | null;
  projects: ProjectOption[];
}

export function ProjectSwitcher({ expanded, appId, projects }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const orgId = user?.org?.id;
  const active = useMemo(
    () => projects.find((project) => project.id === appId) ?? null,
    [appId, projects],
  );
  const label = active?.name ?? "All projects";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="project-switcher-trigger"
          className={cn(
            "flex w-full items-center rounded-2xl border border-border bg-secondary/70 text-left text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5",
            expanded ? "gap-2 px-3 py-2" : "justify-center p-2",
          )}
          title={label}
        >
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FolderKanban className="size-3.5" />
          </span>
          {expanded && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-[300px] border-border bg-popover p-0">
        <Command className="bg-transparent text-foreground">
          <CommandInput placeholder="Search projects..." />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup heading="Projects">
              <CommandItem
                data-testid="project-switcher-all"
                value="all projects"
                onSelect={() => {
                  setOpen(false);
                  navigate(projectsPath());
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-muted"
              >
                <FolderKanban className="size-4 text-muted-foreground" />
                <span className="flex-1 text-sm">All projects</span>
                {!appId && <Check className="size-4 text-primary" />}
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  data-testid={`project-switcher-item-${project.id}`}
                  value={`${project.name} ${project.id}`}
                  onSelect={() => {
                    writeLastProjectId(orgId, project.id);
                    setOpen(false);
                    navigate(appDetailPath(project.id));
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-muted"
                >
                  <FolderKanban className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{project.name}</span>
                  {project.id === appId && <Check className="size-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                data-testid="project-switcher-create"
                value="create project"
                onSelect={() => {
                  setOpen(false);
                  navigate(projectCreatePath());
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-primary data-[selected=true]:bg-muted"
              >
                <Plus className="size-4" />
                <span className="text-sm font-medium">Create project</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
