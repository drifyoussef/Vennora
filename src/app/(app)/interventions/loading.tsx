import { FiltersSkeleton, HeaderSkeleton, RowListSkeleton } from "@/components/vennora/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <FiltersSkeleton chips={5} />
      <RowListSkeleton count={8} />
    </>
  );
}
