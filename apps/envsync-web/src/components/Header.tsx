import { useAuth } from "@/hooks/useAuth";

export const Header = () => {
  const { user } = useAuth();

  return (
    <header className="bg-slate-800 border-b h-20 border-slate-700 px-6 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {/* Organization Info */}
        <div className="flex items-center space-x-3">
          {user?.org?.logo_url ? (
            <img
              src={user.org.logo_url}
              alt={`${user.org.name} logo`}
              className="w-8 h-8 rounded-xl object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-electric_indigo-400 rounded-xl flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.org?.name?.charAt(0)?.toUpperCase() || "O"}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-white font-semibold text-lg">
              {user?.org?.name || "Organization"}
            </h1>
            <span className="text-slate-400 text-xs">@{user?.org?.slug}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
