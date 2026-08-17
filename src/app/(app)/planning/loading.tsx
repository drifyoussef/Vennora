import { HeaderSkeleton, RowListSkeleton } from "@/components/vennora/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="mb-5 flex flex-wrap gap-3">
        <Skeleton className="h-11 w-56 rounded-lg" />
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>
      <RowListSkeleton count={6} />
    </>
  );
}
