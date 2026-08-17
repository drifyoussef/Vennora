import { FiltersSkeleton, HeaderSkeleton, TableSkeleton } from "@/components/vennora/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <FiltersSkeleton />
      <TableSkeleton />
    </>
  );
}
