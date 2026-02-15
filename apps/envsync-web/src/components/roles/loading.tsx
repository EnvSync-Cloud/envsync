import { Skeleton } from "../ui/skeleton";

export const RoleRowSkeleton = () => (
  <tr className="border-b border-gray-700/50">
    <td className="py-3 px-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-9 w-9 rounded-md bg-gray-700" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 bg-gray-700" />
        </div>
      </div>
    </td>
    <td className="py-3 px-4">
      <Skeleton className="h-6 w-20 bg-gray-700 rounded-full" />
    </td>
    <td className="py-3 px-4 flex gap-3 flex-wrap max-w-40">
      <Skeleton className="h-5 w-20 bg-gray-700" />
      <Skeleton className="h-5 w-12 bg-gray-700" />
      <Skeleton className="h-5 w-16 bg-gray-700" />
    </td>
    <td className="py-3 px-4">
      <div className="flex gap-2">
        <Skeleton className="size-12 rounded-full bg-gray-700" />
        <Skeleton className="size-12 items rounded-full bg-gray-700" />
        <Skeleton className="size-12 rounded-full bg-gray-700" />
      </div>
    </td>
    <td className="py-3 px-4 space-y-2">
      <Skeleton className="h-5 w-28 bg-gray-700" />
      <Skeleton className="h-4 w-40 bg-gray-700/60" />
    </td>
    <td className="py-3 px-4 text-right">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-8 bg-gray-700 rounded-md" />
        <Skeleton className="h-8 w-8 bg-gray-700 rounded-md" />
      </div>
    </td>
  </tr>
);
