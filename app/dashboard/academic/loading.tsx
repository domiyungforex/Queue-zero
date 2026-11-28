import { ListSkeleton, PageSkeleton } from "@/components/ui/loading";

export default function AcademicLoading() {
  return (
    <>
      <PageSkeleton cards={3} label="Loading academic workspace" />
      <ListSkeleton rows={4} />
    </>
  );
}
