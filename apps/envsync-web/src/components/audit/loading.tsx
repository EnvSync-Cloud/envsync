import { Skeleton } from "../ui/skeleton";

export const AuditLogRowSkeleton = () => (
  <tr className="border-b border-gray-800">
    <td className="py-3 px-4">
      <div className="flex items-center space-x-2">
        <Skeleton className="size-8 rounded-full bg-gray-800" />
        <div className="flex flex-col space-y-1.5">
          <Skeleton className="w-28 h-3.5 bg-gray-800" />
        </div>
      </div>
    </td>
    <td className="py-3 px-4">
      <Skeleton className="w-16 h-5 bg-gray-800" />
    </td>
    <td className="py-3 px-4">
      <Skeleton className="w-20 h-3.5 bg-gray-800" />
    </td>
    <td className="py-3 px-4">
      <Skeleton className="w-16 h-3.5 bg-gray-800" />
    </td>
    <td className="py-3 px-4">
      <Skeleton className="w-32 h-3.5 bg-gray-800" />
    </td>
  </tr>
);
