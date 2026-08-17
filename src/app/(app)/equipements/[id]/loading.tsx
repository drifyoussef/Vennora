import { HeaderSkeleton } from "@/components/vennora/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-44 rounded-xl" />
      <div className="space-y-8">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 pl-8">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ))}
      </div>
    </>
  );
}
