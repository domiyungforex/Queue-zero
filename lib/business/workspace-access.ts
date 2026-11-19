/** A failed read is not the same thing as a user with no organization. */
export function workspaceAccessDecision(input: { signedIn: boolean; membershipCount: number | null }): "dashboard" | "onboarding" | "retry" | "sign-in" {
  if (!input.signedIn) return "sign-in";
  if (input.membershipCount === null) return "retry";
  if (input.membershipCount === 0) return "onboarding";
  return "dashboard";
}

export class WorkspaceUnavailable extends Error {
  constructor(message = "Your workspace could not be loaded. Please try again.") {
    super(message);
    this.name = "WorkspaceUnavailable";
  }
}
