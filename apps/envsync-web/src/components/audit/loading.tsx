import { Skeleton } from "../ui/skeleton";

export const AuditLogRowSkeleton = () => (
  <tr className="border-b border-gray-700">
    <td className="py-4 px-4">
      <div className="flex items-center space-x-2">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-24 h-3" />
        </div>
      </div>
    </td>
    <td className="py-4 px-4">
      <Skeleton className="w-20 h-5" />
    </td>
    <td className="py-4 px-4 space-y-1">
      <Skeleton className="w-20 h-4" />
      <Skeleton className="w-12 h-2" />
    </td>
    <td className="py-4 px-4">
      <Skeleton className="w-20 h-4" />
      <Skeleton className="w-32 h-3 mt-1" />
    </td>
    <td className="py-4 px-4">
      <Skeleton className="w-40 h-4" />
      <Skeleton className="w-32 h-3 mt-1" />
    </td>
  </tr>
);
