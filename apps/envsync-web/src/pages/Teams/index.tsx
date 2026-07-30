import { useMemo, useState } from "react";
import { Users, Plus, UserPlus, ShieldAlert, Trash2, Pencil, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import { useAuthContext } from "@/contexts/auth";
import { PageShell } from "@/components/PageShell";
import { PageError } from "@/components/ui/page-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const DEFAULT_COLORS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

const Teams = () => {
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const canManage = Boolean(user?.role?.is_admin || user?.role?.is_master);
  const authEnabled = !isAuthLoading && isAuthenticated;

  const { data: teams = [], isLoading: teamsLoading, error: teamsError, refetch: refetchTeams } = api.teams.getTeams({ enabled: authEnabled });
  const { data: roles = [] } = api.roles.getAllRoles({ enabled: authEnabled });
  const { data: users = [] } = api.users.getAllUsers({ enabled: authEnabled });

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const { data: selectedTeam } = api.teams.getTeam(selectedTeamId || undefined, {
    enabled: authEnabled,
  });

  const createTeam = api.teams.createTeam({
    onSuccess: () => toast.success("Team created"),
    onError: ({ error }) => toast.error(error.message || "Failed to create team"),
  });
  const updateTeam = api.teams.updateTeam({
    onSuccess: () => toast.success("Team updated"),
    onError: ({ error }) => toast.error(error.message || "Failed to update team"),
  });
  const deleteTeam = api.teams.deleteTeam({
    onSuccess: () => {
      toast.success("Team deleted");
      setSelectedTeamId(null);
    },
    onError: ({ error }) => toast.error(error.message || "Failed to delete team"),
  });
  const addMember = api.teams.addMember({
    onSuccess: () => toast.success("Member added"),
    onError: ({ error }) => toast.error(error.message || "Failed to add member"),
  });
  const removeMember = api.teams.removeMember({
    onSuccess: () => toast.success("Member removed"),
    onError: ({ error }) => toast.error(error.message || "Failed to remove member"),
  });
  const assignRole = api.teams.assignRole({
    onSuccess: () => toast.success("Team role assigned"),
    onError: ({ error }) => toast.error(error.message || "Failed to assign role"),
  });
  const unassignRole = api.teams.unassignRole({
    onSuccess: () => toast.success("Team role removed"),
    onError: ({ error }) => toast.error(error.message || "Failed to remove role"),
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);

  const [memberUserId, setMemberUserId] = useState("");
  const [teamRoleId, setTeamRoleId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"teams" | "detail">("teams");

  const selectedRoleName = useMemo(() => {
    if (!selectedTeam?.role_id) return "No team role";
    return roles.find((role) => role.id === selectedTeam.role_id)?.name || "Assigned role";
  }, [roles, selectedTeam]);

  const memberIds = useMemo(
    () => new Set(selectedTeam?.members.map((member) => member.user_id) || []),
    [selectedTeam],
  );

  const availableUsers = useMemo(
    () => users.filter((entry) => !memberIds.has(entry.id)),
    [users, memberIds],
  );
  const filteredTeams = useMemo(
    () =>
      teams.filter((team) =>
        `${team.name} ${team.description || ""}`.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery, teams]
  );
  const totalMembers = useMemo(
    () => teams.reduce((count, team) => count + (team.member_count || 0), 0),
    [teams]
  );
  const teamsWithRole = useMemo(
    () => teams.filter((team) => team.role_id).length,
    [teams]
  );

  const openCreate = () => {
    setEditingTeamId(null);
    setName("");
    setDescription("");
    setColor(DEFAULT_COLORS[0]);
    setEditorOpen(true);
  };

  const openEdit = () => {
    if (!selectedTeam) return;
    setEditingTeamId(selectedTeam.id);
    setName(selectedTeam.name);
    setDescription(selectedTeam.description || "");
    setColor(selectedTeam.color || DEFAULT_COLORS[0]);
    setEditorOpen(true);
  };

  const saveTeam = () => {
    if (!name.trim()) return;
    if (editingTeamId) {
      updateTeam.mutate({
        id: editingTeamId,
        payload: { name: name.trim(), description: description.trim() || undefined, color },
      });
    } else {
      createTeam.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
    }
    setEditorOpen(false);
  };

  if (teamsError) {
    return (
      <PageError
        title="Failed to load teams"
        message={teamsError instanceof Error ? teamsError.message : "An unexpected error occurred"}
        onRetry={() => refetchTeams()}
      />
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      <PageShell
        title="Teams"
        description="Create role-bearing teams, manage membership, and make inherited access easier to understand."
        icon={Users}
        isLoading={teamsLoading}
        stickyActions
        actions={
          canManage ? (
            <Button data-testid="teams-create" className="bg-emerald-500 hover:bg-emerald-600" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              New Team
            </Button>
          ) : null
        }
        stats={[
          { label: "Teams", value: teams.length, hint: "Collaboration groups across the org" },
          { label: "Members", value: totalMembers, hint: "Team memberships in total", tone: totalMembers > 0 ? "success" : "default" },
          { label: "Teams With Role", value: teamsWithRole, hint: "Ready for inherited access", tone: teamsWithRole > 0 ? "warning" : "default" },
        ]}
        secondaryNav={
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "teams" | "detail")}>
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger data-testid="teams-tab-directory" value="teams" className="rounded-xl data-[state=active]:bg-emerald-500/18 data-[state=active]:text-foreground">
                Teams Directory
              </TabsTrigger>
              <TabsTrigger data-testid="teams-tab-detail" value="detail" className="rounded-xl data-[state=active]:bg-emerald-500/18 data-[state=active]:text-foreground">
                Team Details
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
      {activeTab === "teams" ? (
        <Card data-testid="teams-directory-list" className="border-border bg-card/70">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search teams…"
                className="max-w-sm border-border bg-card text-foreground"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Description</TableHead>
                  <TableHead className="text-muted-foreground">Team Role</TableHead>
                  <TableHead className="text-muted-foreground">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.length === 0 ? (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={4} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="size-8 text-tertiary" />
                        <div>
                          <p className="font-medium text-muted-foreground">No teams yet</p>
                          <p className="mt-1 text-sm text-tertiary">Create your first team to start managing access.</p>
                        </div>
                        {canManage && (
                          <Button variant="outline" className="border-border text-foreground" onClick={openCreate}>
                            <Plus className="mr-2 size-4" />
                            Create your first team
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                filteredTeams.map((team) => (
                  <TableRow
                    key={team.id}
                    data-testid={`teams-row-${team.id}`}
                    className={`cursor-pointer border-border ${selectedTeamId === team.id ? "bg-card" : "hover:bg-card/60"}`}
                    onClick={() => {
                      setSelectedTeamId(team.id);
                      setActiveTab("detail");
                    }}
                  >
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{team.description || "No description"}</TableCell>
                    <TableCell>
                      {team.role_id ? (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">
                          {roles.find((role) => role.id === team.role_id)?.name || "Assigned"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          None
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(team.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="teams-detail-panel" className="border-border bg-card/70">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-foreground">
                {selectedTeam ? selectedTeam.name : "Select a team"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedTeam
                  ? "Members inherit the team role and any app access granted to this team."
                  : "Pick a team from the directory to manage membership and the shared role."}
              </p>
            </div>
            {selectedTeam && canManage && (
              <div className="flex gap-2">
                <Button variant="outline" className="border-border text-foreground" onClick={openEdit}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="border-red-700 text-red-300 hover:bg-red-950"
                  onClick={() => deleteTeam.mutate(selectedTeam.id)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedTeam ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card/70 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldAlert className="size-4 text-emerald-400" />
                      <h3 className="font-medium text-foreground">Team Role</h3>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Team members keep their direct org role and also inherit this team-scoped role bundle.
                    </p>
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">
                        {selectedRoleName}
                      </Badge>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <Select value={teamRoleId} onValueChange={setTeamRoleId}>
                          <SelectTrigger className="border-border bg-card text-foreground">
                            <SelectValue placeholder="Choose role" />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            {roles
                              .filter((role) => !role.isMaster)
                              .map((role) => (
                                <SelectItem key={role.id} value={role.id} className="text-foreground">
                                  {role.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          className="bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => teamRoleId && assignRole.mutate({ teamId: selectedTeam.id, role_id: teamRoleId })}
                        >
                          Assign
                        </Button>
                        {selectedTeam.role_id && (
                          <Button
                            variant="outline"
                            className="border-border text-foreground"
                            onClick={() => unassignRole.mutate({ teamId: selectedTeam.id })}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-card/70 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <UserPlus className="size-4 text-emerald-400" />
                      <h3 className="font-medium text-foreground">Add Member</h3>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      App access can be granted to the team, and every member inherits that access automatically.
                    </p>
                    {canManage ? (
                      <div className="flex gap-2">
                        <Select value={memberUserId} onValueChange={setMemberUserId}>
                          <SelectTrigger className="border-border bg-card text-foreground">
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            {availableUsers.map((entry) => (
                              <SelectItem key={entry.id} value={entry.id} className="text-foreground">
                                {entry.full_name || entry.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          className="bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => memberUserId && addMember.mutate({ teamId: selectedTeam.id, user_id: memberUserId })}
                        >
                          Add
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-tertiary">Admin access required to manage membership.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card/70 p-4">
                  <h3 className="mb-3 font-medium text-foreground">Members</h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">User</TableHead>
                        <TableHead className="text-muted-foreground">Email</TableHead>
                        <TableHead className="text-muted-foreground">Joined</TableHead>
                        <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTeam.members.map((member) => (
                        <TableRow key={member.id} className="border-border">
                          <TableCell className="text-foreground">{member.full_name || "Unnamed user"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            <span className="hdx-mask">{member.email}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage && (
                              <Button
                                variant="ghost"
                                className="text-red-300 hover:bg-red-950 hover:text-red-200"
                                onClick={() => removeMember.mutate({ teamId: selectedTeam.id, userId: member.user_id })}
                              >
                                <UserMinus className="mr-2 size-4" />
                                Remove
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div data-testid="teams-empty-detail" className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
                Pick a team from the directory to manage membership, shared roles, and inherited access.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="right" className="border-border bg-card sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-foreground">
              {editingTeamId ? "Edit Team" : "Create Team"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} className="border-border bg-card text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="border-border bg-card text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Color</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`size-8 rounded-full border-2 ${color === value ? "border-white" : "border-transparent"}`}
                    style={{ backgroundColor: value }}
                    onClick={() => setColor(value)}
                  />
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="mt-8">
            <Button variant="outline" className="border-border text-foreground" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={saveTeam}>
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      </PageShell>
    </div>
  );
};

export default Teams;
