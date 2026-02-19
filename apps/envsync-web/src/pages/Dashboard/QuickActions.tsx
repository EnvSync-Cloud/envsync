import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Key, Activity } from "lucide-react";

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => navigate("/applications/create")}
        className="bg-violet-500 hover:bg-violet-600 text-white"
      >
        <Plus className="size-4 mr-2" />
        Create Project
      </Button>
      <Button
        onClick={() => navigate("/users")}
        variant="outline"
        className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100"
      >
        <UserPlus className="size-4 mr-2" />
        Invite Team Member
      </Button>
      <Button
        onClick={() => navigate("/apikeys")}
        variant="outline"
        className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100"
      >
        <Key className="size-4 mr-2" />
        Generate API Key
      </Button>
      <Button
        onClick={() => navigate("/audit")}
        variant="outline"
        className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100"
      >
        <Activity className="size-4 mr-2" />
        View Activity Log
      </Button>
    </div>
  );
}
