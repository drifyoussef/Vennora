import { HeaderSkeleton } from "@/components/vennora/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-4xl">
      <HeaderSkeleton withAction={false} />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="mb-6 h-52 rounded-xl" />
      ))}
    </div>
  );
}
