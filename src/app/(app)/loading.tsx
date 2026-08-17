import { HeaderSkeleton, RowListSkeleton } from "@/components/vennora/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <section className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="mt-5">
          <RowListSkeleton count={4} />
        </div>
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </>
  );
}
