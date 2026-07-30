import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRow, UserRowSkeleton } from "./UserRow";
import { EmptyState } from "./EmptyState";
import { Users } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Count } from "../ui/count";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
  status: string;
  lastSeen: string;
  avatar: string;
}

interface UsersTableProps {
  loading?: boolean;
  users?: User[];
  actionLoadingStates: Record<string, boolean>;
  canManageUsers: boolean;
  onInviteClick: () => void;
  onEditRole: (user: User) => void;
  onDeleteUser: (user: User) => void;
  refetch: () => void;
}

export const UsersTable = ({
  loading = true,
  users,
  actionLoadingStates,
  canManageUsers,
  onInviteClick,
  onEditRole,
  onDeleteUser,
}: UsersTableProps) => {
  return (
    <Card className="bg-card text-card-foreground border-border shadow-xl rounded-xl">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-3">
          <Users className="size-8 bg-emerald-400 border border-emerald-600 p-2 stroke-[3] text-white rounded-md" />
          Team Members
          <Count size="xl" variant="subtle" count={users?.length} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!loading && users.length === 0 ? (
          <EmptyState onInviteClick={onInviteClick} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Member
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Last Seen
                  </th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }, (_, index) => (
                      <UserRowSkeleton key={index} />
                    ))
                  : users.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isLoading={actionLoadingStates[user.id]}
                        canManageUsers={canManageUsers}
                        onEditRole={onEditRole}
                        onDeleteUser={onDeleteUser}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
