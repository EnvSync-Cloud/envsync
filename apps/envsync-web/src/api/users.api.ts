import { useQuery } from "@tanstack/react-query";
import { sdk } from "./base";
import { API_KEYS } from "@/constants";

const useAllUsers = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_USERS],
    queryFn: async () => {
      const usersData = await sdk.users.getUsers();
      return usersData;
    },
    refetchOnWindowFocus: false,
  });
};

export const users = {
  getAllUsers: useAllUsers,
};
