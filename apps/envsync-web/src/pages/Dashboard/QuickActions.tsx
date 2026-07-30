import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Key, Activity } from "lucide-react";

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <Button
        onClick={() => navigate("/applications/create")}
        className="bg-emerald-500 hover:bg-emerald-600 text-white w-full justify-start shadow-glow-sm hover:shadow-glow-md transition-all duration-200"
      >
        <Plus className="size-4 mr-2" />
        Create Project
      </Button>
      <Button
        onClick={() => navigate("/users")}
        variant="outline"
        className="border-border text-muted-foreground hover:bg-emerald-500/5 hover:border-emerald-500/30 hover:text-foreground w-full justify-start"
      >
        <UserPlus className="size-4 mr-2" />
        Invite Member
      </Button>
      <Button
        onClick={() => navigate("/apikeys")}
        variant="outline"
        className="border-border text-muted-foreground hover:bg-emerald-500/5 hover:border-emerald-500/30 hover:text-foreground w-full justify-start"
      >
        <Key className="size-4 mr-2" />
        Generate API Key
      </Button>
      <Button
        onClick={() => navigate("/audit")}
        variant="outline"
        className="border-border text-muted-foreground hover:bg-emerald-500/5 hover:border-emerald-500/30 hover:text-foreground w-full justify-start"
      >
        <Activity className="size-4 mr-2" />
        View Activity
      </Button>
    </div>
  );
}
