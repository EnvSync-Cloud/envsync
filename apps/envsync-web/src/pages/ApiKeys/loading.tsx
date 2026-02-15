export const ApiKeysLoadingPage = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="flex flex-col items-center space-y-4">
        <div className="size-12 border-4 border-t-electric_indigo-500 border-gray-700 rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading your API keys...</p>
      </div>
    </div>
  );
};
