export const ApplicationsLoadingPage = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center space-y-4">
        <div className="size-12 border-4 border-t-emerald-500 border-slate-700 rounded-full animate-spin"></div>
        <div className="text-slate-400">Loading your projects...</div>
      </div>
    </div>
  );
};
