import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LockKeyhole, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import { useAuthContext } from "@/contexts/auth";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appDetailPath } from "@/lib/app-routes";

const relationPriority = { viewer: 1, editor: 2, admin: 3 } as const;
const sourceOrder = ["org", "direct", "team"] as const;

const ProjectAccess = () => {
  const { appId } = useParams();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const authEnabled = !isAuthLoading && isAuthenticated;

  const [subjectType, setSubjectType] = useState<"user" | "team">("user");
  const [subjectId, setSubjectId] = useState("");
  const [relation, setRelation] = useState<"viewer" | "editor" | "admin">("viewer");
  const [activeSection, setActiveSection] = useState<"access" | "effective">("access");

  const appQuery = api.applications.allApplications({ enabled: authEnabled });
  const project = useMemo(
    () => appQuery.data.find((entry) => entry.id === appId),
    [appQuery.data, appId],
  );

  const { data: permissions } = api.permissions.getMyPermissions({ enabled: authEnabled });
  const canManage = Boolean(permissions?.can_manage_apps);
  const { data: grants = [] } = api.permissions.getAppGrants(appId, { enabled: authEnabled });
  const { data: effectiveAccess = [] } = api.permissions.getAppEffectiveAccess(appId, { enabled: authEnabled });
  const { data: teams = [] } = api.teams.getTeams({ enabled: authEnabled });
  const { data: users = [] } = api.users.getAllUsers({ enabled: authEnabled });

  const grantAccess = api.permissions.grantAppAccess({
    onSuccess: () => toast.success("Access granted"),
    onError: ({ error }) => toast.error(error.message || "Failed to grant access"),
  });
  const revokeAccess = api.permissions.revokeAppAccess({
    onSuccess: () => toast.success("Access revoked"),
    onError: ({ error }) => toast.error(error.message || "Failed to revoke access"),
  });

  const subjectOptions = subjectType === "user"
    ? users.map((entry) => ({
        id: entry.id,
        label: entry.full_name || entry.email,
        sublabel: entry.email,
      }))
    : teams.map((entry) => ({
        id: entry.id,
        label: entry.name,
        sublabel: entry.description || "Team",
      }));

  const handleGrant = () => {
    if (!appId || !subjectId) return;
    grantAccess.mutate({
      appId,
      payload: { subject_id: subjectId, subject_type: subjectType, relation },
    });
  };

  const grantSummary = useMemo(() => {
    const directUsers = grants.filter((grant) => grant.subject_type === "user").length;
    const directTeams = grants.filter((grant) => grant.subject_type === "team").length;
    const inherited = effectiveAccess.filter((entry) => entry.sources.includes("team")).length;
    const orgUsers = effectiveAccess.filter((entry) => entry.sources.includes("org")).length;
    return { directUsers, directTeams, inherited, orgUsers };
  }, [effectiveAccess, grants]);

  const effectiveTeamAccess = useMemo(
    () =>
      grants
        .filter((grant) => grant.subject_type === "team")
        .map((grant) => ({
          ...grant,
          teamName: teams.find((entry) => entry.id === grant.subject_id)?.name || grant.subject_id,
          source: "direct team grant" as const,
        }))
        .sort((left, right) => left.teamName.localeCompare(right.teamName)),
    [grants, teams],
  );

  const handleSectionChange = (value: string) => {
    setActiveSection(value === "effective" ? "effective" : "access");
  };

  if (!appId || !project) {
    return (
      <div className="animate-page-enter rounded-lg border border-dashed border-border bg-card/60 p-8 text-center text-muted-foreground">
        Project not found.
      </div>
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      <PageShell
        title="Project Access"
        description={`Direct project grants, team-based access, and org-derived visibility for ${project.name}.`}
        icon={LockKeyhole}
        actions={
          <Button asChild variant="outline" className="border-border text-foreground">
            <Link to={appDetailPath(appId)}>Back to project</Link>
          </Button>
        }
        stats={[
          { label: "Project User Grants", value: <span data-testid="project-access-summary-direct-users">{grantSummary.directUsers}</span>, hint: "Users granted on this project directly" },
          { label: "Team Grants", value: <span data-testid="project-access-summary-team-grants">{grantSummary.directTeams}</span>, hint: "Team level access bundles" },
          { label: "Org Baseline Users", value: <span>{grantSummary.orgUsers}</span>, hint: "Users visible here because of org level access", tone: grantSummary.orgUsers > 0 ? "success" : "default" },
          { label: "Team Inherited Users", value: <span data-testid="project-access-summary-inherited-users">{grantSummary.inherited}</span>, hint: "Users inheriting access through teams", tone: grantSummary.inherited > 0 ? "success" : "default" },
        ]}
        secondaryNav={
          <Tabs data-testid="project-access-tabs" value={activeSection} onValueChange={handleSectionChange}>
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger data-testid="project-access-tab-control" value="access" className="rounded-xl bg-emerald-500/12 text-foreground data-[state=active]:bg-emerald-500/18 data-[state=active]:text-foreground">
                Access Control
              </TabsTrigger>
              <TabsTrigger data-testid="project-access-tab-effective" value="effective" className="rounded-xl text-muted-foreground data-[state=active]:bg-emerald-500/18 data-[state=active]:text-foreground">
                Effective Permissions
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
      {activeSection === "access" ? (
        <div data-testid="project-access-panel-control" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border bg-card/70">
            <CardHeader>
              <CardTitle className="text-foreground">Grant Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Subject type</p>
                  <Select value={subjectType} onValueChange={(value) => setSubjectType(value as "user" | "team")}>
                    <SelectTrigger className="border-border bg-card text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="user" className="text-foreground">User</SelectItem>
                      <SelectItem value="team" className="text-foreground">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger className="border-border bg-card text-foreground">
                        <SelectValue placeholder={`Select ${subjectType}`} />
                      </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {subjectOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id} className="text-foreground">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Access level</p>
                  <Select value={relation} onValueChange={(value) => setRelation(value as "viewer" | "editor" | "admin")}>
                    <SelectTrigger className="border-border bg-card text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="viewer" className="text-foreground">Viewer</SelectItem>
                      <SelectItem value="editor" className="text-foreground">Editor</SelectItem>
                      <SelectItem value="admin" className="text-foreground">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="mt-6 bg-emerald-500 hover:bg-emerald-600"
                  onClick={handleGrant}
                  disabled={!canManage || !subjectId}
                >
                  Grant access
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/70">
            <CardHeader>
              <CardTitle className="text-foreground">Direct Grants</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Subject</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Relation</TableHead>
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.map((grant) => {
                    const label = grant.subject_type === "user"
                      ? users.find((entry) => entry.id === grant.subject_id)?.email || grant.subject_id
                      : teams.find((entry) => entry.id === grant.subject_id)?.name || grant.subject_id;

                    return (
                      <TableRow key={`${grant.subject_type}-${grant.subject_id}-${grant.relation}`} className="border-border">
                        <TableCell className="text-foreground">
                          <span className={grant.subject_type === "user" ? "hdx-mask" : undefined}>{label}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">{grant.subject_type}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">
                            {grant.relation}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <Button
                              variant="ghost"
                              className="text-red-300 hover:bg-red-950 hover:text-red-200"
                              onClick={() =>
                                revokeAccess.mutate({
                                  appId,
                                  payload: grant,
                                })
                              }
                            >
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div data-testid="project-access-panel-effective" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card data-testid="project-access-effective-users" className="border-border bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="size-5 text-emerald-400" />
                Effective User Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Effective Role</TableHead>
                    <TableHead className="text-muted-foreground">Source</TableHead>
                    <TableHead className="text-muted-foreground">Inherited Teams</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {effectiveAccess
                    .slice()
                    .sort((a, b) => (relationPriority[b.relation || "viewer"] || 0) - (relationPriority[a.relation || "viewer"] || 0))
                    .map((entry) => (
                      <TableRow key={entry.user_id} className="border-border">
                        <TableCell className="text-foreground">
                          <span className="hdx-mask">{entry.email}</span>
                        </TableCell>
                        <TableCell>
                          {entry.relation ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">
                              {entry.relation}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">No access</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.sources.length ? (
                            <div className="flex flex-wrap gap-2">
                              {sourceOrder
                                .filter((source) => entry.sources.includes(source))
                                .map((source) => (
                                  <Badge key={source} variant="secondary" className="bg-blue-500/10 text-blue-300">
                                    {source}
                                  </Badge>
                                ))}
                            </div>
                          ) : (
                            <span className="text-tertiary">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.teams.length ? entry.teams.join(", ") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="project-access-effective-teams" className="border-border bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="size-5 text-blue-400" />
                Effective Team Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Team</TableHead>
                    <TableHead className="text-muted-foreground">Granted Role</TableHead>
                    <TableHead className="text-muted-foreground">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {effectiveTeamAccess.length ? (
                    effectiveTeamAccess.map((grant) => (
                      <TableRow key={`${grant.subject_id}-${grant.relation}`} className="border-border">
                        <TableCell className="text-foreground">{grant.teamName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">
                            {grant.relation}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{grant.source}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-border">
                      <TableCell colSpan={3} className="py-8 text-center text-tertiary">
                        No team grants in effect.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
      </PageShell>
    </div>
  );
};

export default ProjectAccess;
