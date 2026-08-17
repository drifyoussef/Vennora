import { DetailSkeleton, HeaderSkeleton } from "@/components/vennora/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <DetailSkeleton panels={4} aside={false} />
    </>
  );
}
