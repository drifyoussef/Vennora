import { FiltersSkeleton, HeaderSkeleton } from "@/components/vennora/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton withAction={false} />
      <FiltersSkeleton chips={3} />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </>
  );
}
