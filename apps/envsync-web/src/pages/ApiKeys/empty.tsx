import { Button } from "@/components/ui/button";
import { Function } from "@/utils/env";
import { Key, Plus } from "lucide-react";

interface EmptyApiKeysProps {
  setIsCreateModalOpen: Function<boolean>;
  isCreatingApiKey?: boolean;
}

export const EmptyApiKeys = ({
  isCreatingApiKey,
  setIsCreateModalOpen,
}: EmptyApiKeysProps) => (
  <div className="text-center py-12">
    <Key className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
    <h3 className="text-xl font-medium text-foreground mb-2">No API Keys</h3>
    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
      Create your first API key to start using EnvSync services. API keys allow
      you to authenticate and access our APIs programmatically.
    </p>
    <Button
      onClick={() => setIsCreateModalOpen(true)}
      className="bg-emerald-500 hover:bg-emerald-600 text-white"
      disabled={isCreatingApiKey}
    >
      <Plus className="w-4 h-4 mr-2" />
      Create Your First API Key
    </Button>
  </div>
);
