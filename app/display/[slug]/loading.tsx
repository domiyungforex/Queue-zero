import { PageSkeleton } from "@/components/ui/loading";
export default function DisplayLoading() { return <main id="main" className="loading-screen"><PageSkeleton cards={2} label="Loading queue display" /></main>; }
