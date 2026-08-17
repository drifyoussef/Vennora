import { CardGridSkeleton, HeaderSkeleton } from "@/components/vennora/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-36 rounded-xl" />
      <CardGridSkeleton count={6} />
    </>
  );
}
