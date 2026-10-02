import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
export const metadata:Metadata={title:"Create your account"};
export default function Page(){return <AuthShell title="Make room for better service." description="Create your business account. Your first queue is a few steps away."><AuthForm mode="sign-up"/></AuthShell>}
