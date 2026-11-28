import { ListSkeleton } from "@/components/ui/loading";

export default function AssignmentsLoading() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Assignments</h1>
          <p className="page-description">Loading assignments…</p>
        </div>
      </div>
      <ListSkeleton rows={5} />
    </>
  );
}
