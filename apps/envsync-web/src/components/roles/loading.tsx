import { Skeleton } from "../ui/skeleton";

export const RoleRowSkeleton = () => (
  <tr className="border-b border-border">
    <td className="py-3 px-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-9 w-9 rounded-md bg-muted" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 bg-muted" />
        </div>
      </div>
    </td>
    <td className="py-3 px-4">
      <Skeleton className="h-6 w-20 bg-muted rounded-full" />
    </td>
    <td className="py-3 px-4 flex gap-3 flex-wrap max-w-40">
      <Skeleton className="h-5 w-20 bg-muted" />
      <Skeleton className="h-5 w-12 bg-muted" />
      <Skeleton className="h-5 w-16 bg-muted" />
    </td>
    <td className="py-3 px-4">
      <div className="flex gap-2">
        <Skeleton className="size-12 rounded-full bg-muted" />
        <Skeleton className="size-12 items rounded-full bg-muted" />
        <Skeleton className="size-12 rounded-full bg-muted" />
      </div>
    </td>
    <td className="py-3 px-4 space-y-2">
      <Skeleton className="h-5 w-28 bg-muted" />
      <Skeleton className="h-4 w-40 bg-muted/60" />
    </td>
    <td className="py-3 px-4 text-right">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-8 bg-muted rounded-md" />
        <Skeleton className="h-8 w-8 bg-muted rounded-md" />
      </div>
    </td>
  </tr>
);
