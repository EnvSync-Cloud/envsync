import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { sdk } from "@/api/base";
import {
  Database,
  Plus,
  UserPlus,
  Key,
  Users,
  Shield,
  Clock,
  Trash2,
} from "lucide-react";

interface RecentItem {
  id: string;
  type: "project" | "user" | "team" | "apikey";
  name: string;
  href: string;
  timestamp: number;
}

const RECENT_ITEMS_KEY = "envsync-cmdk-recent";
const MAX_RECENT = 5;

function getRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(RECENT_ITEMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentItem(item: Omit<RecentItem, "timestamp">) {
  const recent = getRecentItems().filter((r) => r.id !== item.id);
  recent.unshift({ ...item, timestamp: Date.now() });
  localStorage.setItem(
    RECENT_ITEMS_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

function clearRecentItems() {
  localStorage.removeItem(RECENT_ITEMS_KEY);
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { allowedScopes } = useAuthContext();
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

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

  useEffect(() => {
    if (open) {
      setRecentItems(getRecentItems());
      setSearch("");
    }
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }, []);

  const authorizedNavItems = useMemo(
    () => navItems.filter((item) => allowedScopes.includes(item.id)),
    [allowedScopes]
  );

  const { data: projects = [] } = useQuery<
    Array<{ id: string; name: string; description?: string }>
  >({
    queryKey: [API_KEYS.ALL_APPLICATIONS],
    queryFn: async () => {
      const appsData = await sdk.applications.getApps();
      return appsData.map((app) => ({
        id: app.id,
        name: app.name,
        description: app.description || "",
      }));
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery<
    Array<{ id: string; full_name: string | null; email: string }>
  >({
    queryKey: [API_KEYS.ALL_USERS],
    queryFn: async () => {
      return await sdk.users.getUsers();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams = [] } = useQuery<
    Array<{ id: string; name: string; description: string | null }>
  >({
    queryKey: [API_KEYS.ALL_TEAMS],
    queryFn: async () => {
      return await sdk.teams.getTeams();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: apiKeys = [] } = useQuery<
    Array<{ id: string; description: string; key: string }>
  >({
    queryKey: [API_KEYS.ALL_API_KEYS],
    queryFn: async () => {
      return await sdk.apiKeys.getAllApiKeys();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const filteredProjects = useMemo(() => {
    if (!search) return projects.slice(0, 8);
    const q = search.toLowerCase();
    return projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [projects, search]);

  const filteredUsers = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return users
      .filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [users, search]);

  const filteredTeams = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return teams
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [teams, search]);

  const filteredApiKeys = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return apiKeys
      .filter(
        (k) =>
          k.description?.toLowerCase().includes(q) ||
          k.key.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [apiKeys, search]);

  const filteredNavItems = useMemo(() => {
    if (!search) return authorizedNavItems;
    const q = search.toLowerCase();
    return authorizedNavItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [authorizedNavItems, search]);

  const filteredRecent = useMemo(() => {
    if (!search) return recentItems;
    const q = search.toLowerCase();
    return recentItems.filter((r) => r.name.toLowerCase().includes(q));
  }, [recentItems, search]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const navigateToProject = (project: { id: string; name: string }) => {
    addRecentItem({
      id: project.id,
      type: "project",
      name: project.name,
      href: `/applications/${project.id}`,
    });
    runAction(() =>
      navigate(`/applications/${project.id}`)
    );
  };

  const navigateToUser = (user: { id: string; full_name: string | null; email: string }) => {
    addRecentItem({
      id: user.id,
      type: "user",
      name: user.full_name || user.email,
      href: `/users`,
    });
    runAction(() => navigate(`/users`));
  };

  const navigateToTeam = (team: { id: string; name: string }) => {
    addRecentItem({
      id: team.id,
      type: "team",
      name: team.name,
      href: `/teams`,
    });
    runAction(() => navigate(`/teams`));
  };

  const navigateToApiKey = (key: { id: string; description: string }) => {
    addRecentItem({
      id: key.id,
      type: "apikey",
      name: key.description || "API Key",
      href: `/apikeys`,
    });
    runAction(() => navigate(`/apikeys`));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} onKeyDown={handleKeyDown}>
      <CommandInput
        placeholder="Search projects, users, teams, keys..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredRecent.length > 0 && (
          <CommandGroup heading="Recent">
            {filteredRecent.map((item) => {
              const Icon =
                item.type === "project"
                  ? Database
                  : item.type === "user"
                    ? UserPlus
                    : item.type === "team"
                      ? Users
                      : Key;
              return (
                <CommandItem
                  key={`recent-${item.id}`}
                  onSelect={() => runAction(() => navigate(item.href))}
                  value={`recent-${item.id}-${item.name}`}
                >
                  <Clock className="mr-2 size-4 text-muted-foreground" />
                  <Icon className="mr-2 size-4" />
                  <span>{item.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">
                    {item.type}
                  </span>
                </CommandItem>
              );
            })}
            <CommandItem
              onSelect={() => {
                clearRecentItems();
                setRecentItems([]);
              }}
              value="clear-recent"
            >
              <Trash2 className="mr-2 size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Clear recent</span>
            </CommandItem>
          </CommandGroup>
        )}

        {filteredRecent.length > 0 && filteredNavItems.length > 0 && (
          <CommandSeparator />
        )}

        {filteredNavItems.length > 0 && (
          <CommandGroup heading="Navigation">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  onSelect={() => runAction(() => navigate(item.href))}
                  value={`nav-${item.id}`}
                >
                  <Icon className="mr-2 size-4" />
                  <span>{item.name}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredProjects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {filteredProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => navigateToProject(project)}
                  value={`project-${project.id}-${project.name}`}
                >
                  <Database className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span>{project.name}</span>
                    {project.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {project.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredUsers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Users">
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => navigateToUser(user)}
                  value={`user-${user.id}-${user.full_name}-${user.email}`}
                >
                  <UserPlus className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span>{user.full_name || "Unnamed User"}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredTeams.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Teams">
              {filteredTeams.map((team) => (
                <CommandItem
                  key={team.id}
                  onSelect={() => navigateToTeam(team)}
                  value={`team-${team.id}-${team.name}`}
                >
                  <Users className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span>{team.name}</span>
                    {team.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {team.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredApiKeys.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="API Keys">
              {filteredApiKeys.map((apiKey) => (
                <CommandItem
                  key={apiKey.id}
                  onSelect={() => navigateToApiKey(apiKey)}
                  value={`apikey-${apiKey.id}-${apiKey.description}`}
                >
                  <Key className="mr-2 size-4" />
                  <span>{apiKey.description || "Untitled Key"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!search && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() =>
                  runAction(() => navigate("/applications/create"))
                }
                value="create-project"
              >
                <Plus className="mr-2 size-4" />
                <span>Create Project</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runAction(() => navigate("/users"))}
                value="invite-member"
              >
                <UserPlus className="mr-2 size-4" />
                <span>Invite Team Member</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runAction(() => navigate("/apikeys"))}
                value="manage-apikeys"
              >
                <Key className="mr-2 size-4" />
                <span>Manage API Keys</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runAction(() => navigate("/roles"))}
                value="manage-roles"
              >
                <Shield className="mr-2 size-4" />
                <span>Manage Roles</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
