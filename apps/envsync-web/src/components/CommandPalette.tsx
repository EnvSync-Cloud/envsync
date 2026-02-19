import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { navItems, API_KEYS } from "@/constants";
import { useAuthContext } from "@/contexts/auth";
import { Database, Plus, UserPlus, Key } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { allowedScopes } = useAuthContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-command-palette", handleOpen);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("open-command-palette", handleOpen);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const authorizedNavItems = useMemo(
    () => navItems.filter((item) => allowedScopes.includes(item.id)),
    [allowedScopes]
  );

  const projects = useMemo(() => {
    const apps = queryClient.getQueryData<
      Array<{ id: string; name: string; description?: string }>
    >([API_KEYS.ALL_APPLICATIONS]);
    return apps ?? [];
  }, [queryClient, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {authorizedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                onSelect={() =>
                  runAction(() =>
                    navigate(item.id === "dashboard" ? "/" : `/${item.id}`)
                  )
                }
              >
                <Icon className="mr-2 size-4" />
                <span>{item.name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.slice(0, 10).map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() =>
                    runAction(() =>
                      navigate(
                        `/applications/${project.name}-${project.id}`
                      )
                    )
                  }
                >
                  <Database className="mr-2 size-4" />
                  <span>{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() =>
              runAction(() => navigate("/applications/create"))
            }
          >
            <Plus className="mr-2 size-4" />
            <span>Create Project</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => navigate("/users"))}
          >
            <UserPlus className="mr-2 size-4" />
            <span>Invite Team Member</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => navigate("/apikeys"))}
          >
            <Key className="mr-2 size-4" />
            <span>Manage API Keys</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
