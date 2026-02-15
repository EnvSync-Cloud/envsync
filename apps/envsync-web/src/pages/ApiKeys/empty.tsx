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
    <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
    <h3 className="text-xl font-medium text-white mb-2">No API Keys</h3>
    <p className="text-gray-400 mb-6 max-w-md mx-auto">
      Create your first API key to start using EnvSync services. API keys allow
      you to authenticate and access our APIs programmatically.
    </p>
    <Button
      onClick={() => setIsCreateModalOpen(true)}
      className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
      disabled={isCreatingApiKey}
    >
      <Plus className="w-4 h-4 mr-2" />
      Create Your First API Key
    </Button>
  </div>
);
