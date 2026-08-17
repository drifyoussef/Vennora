import { CardGridSkeleton, FiltersSkeleton, HeaderSkeleton } from "@/components/vennora/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <FiltersSkeleton />
      <CardGridSkeleton />
    </>
  );
}
