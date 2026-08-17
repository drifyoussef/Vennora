import { HeaderSkeleton, TableSkeleton } from "@/components/vennora/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton withAction={false} />
      <TableSkeleton rows={8} />
    </>
  );
}
