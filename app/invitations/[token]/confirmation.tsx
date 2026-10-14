"use client";
import { useActionState } from "react";
import { acceptInstitutionInvitation } from "./actions";
export function InvitationConfirmation({ token }: { token: string }) {
 const [state, action, pending] = useActionState(acceptInstitutionInvitation.bind(null, token), { message: '' });
 return <form action={action} className="space-y-5"><p>Your verified email must match the invitation. Your existing account will be used.</p><label className="flex items-start gap-3"><input type="checkbox" name="confirm" value="yes" required disabled={pending} />I want to join the institution and unit specified by my invitation.</label>{state.message && <p role="alert">{state.message}</p>}<button className="button-primary" disabled={pending}>{pending ? 'Joining…' : 'Accept invitation'}</button></form>;
}
