import { redirect } from "next/navigation";

// Preserve old bookmarks by sending them to the authenticated, real workspace.
export default function LegacyWorkspace() { redirect("/dashboard"); }
