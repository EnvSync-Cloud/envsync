import { useQueryClient } from "@tanstack/react-query";
import { PageError } from "@/components/ui/page-error";

export const UserSettingsErrorPage = () => {
  const queryClient = useQueryClient();

  return (
    <PageError
      fullScreen
      title="Failed to load user settings"
      onRetry={() => queryClient.invalidateQueries({ queryKey: ["userInfo"] })}
    />
  );
};
