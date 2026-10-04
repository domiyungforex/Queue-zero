// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({send:vi.fn(),verify:vi.fn(),create:vi.fn(),signupSend:vi.fn(),signupVerify:vi.fn(),finalize:vi.fn(),search:new URLSearchParams(),phoneSend:vi.fn(),state:{status:"needs_identifier"}}));
vi.mock("next/navigation",()=>({useSearchParams:()=>mocks.search}));
vi.mock("@clerk/nextjs",()=>({
 useAuth:()=>({isSignedIn:false}),
 ClerkLoaded:({children}:{children:React.ReactNode})=>children,ClerkLoading:()=>null,ClerkFailed:()=>null,
 SignIn:({forceRedirectUrl}:{forceRedirectUrl:string})=><p>Secure additional verification {forceRedirectUrl}</p>,SignUp:()=> <p>Additional signup requirements</p>,
 useSignIn:()=>({signIn:{get status(){return mocks.state.status},emailCode:{sendCode:mocks.send,verifyCode:mocks.verify},phoneCode:{sendCode:mocks.phoneSend,verifyCode:mocks.verify},finalize:mocks.finalize}}),
 useSignUp:()=>({signUp:{get status(){return mocks.state.status},create:mocks.create,verifications:{sendEmailCode:mocks.signupSend,verifyEmailCode:mocks.signupVerify,sendPhoneCode:mocks.signupSend,verifyPhoneCode:mocks.signupVerify},finalize:mocks.finalize}}),
}));
import {AuthForm} from "@/components/auth/auth-form";
beforeEach(()=>{mocks.search=new URLSearchParams("redirect_url=%2Fattend%3Ftoken%3Dopaque-token");mocks.state.status="needs_identifier";for(const mock of [mocks.send,mocks.verify,mocks.create,mocks.signupSend,mocks.signupVerify,mocks.finalize,mocks.phoneSend])mock.mockResolvedValue({error:null});});
afterEach(()=>{cleanup();vi.unstubAllEnvs()});
async function send(mode:"sign-in"|"sign-up"="sign-in"){render(<AuthForm mode={mode}/>);fireEvent.change(screen.getByLabelText("Email address"),{target:{value:"student@school.test"}});fireEvent.click(screen.getByRole("button",{name:"Email me a code"}));await screen.findByLabelText("Verification code")}
describe("custom Clerk OTP",()=>{
 it("sends email OTP with no password and preserves full attendance URL across signup",async()=>{await send();expect(mocks.send).toHaveBeenCalledWith({emailAddress:"student@school.test"});expect(screen.getByRole("link",{name:"Create an account"}).getAttribute("href")).toBe("/sign-up?redirect_url=%2Fattend%3Ftoken%3Dopaque-token");expect(screen.queryByLabelText(/password/i)).toBeNull()});
 it("creates passwordless signup then verifies email and activates session",async()=>{await send("sign-up");expect(mocks.create).toHaveBeenCalledWith({emailAddress:"student@school.test"});expect(mocks.signupSend).toHaveBeenCalledTimes(1);mocks.state.status="complete";fireEvent.change(screen.getByLabelText("Verification code"),{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Verify and continue"}));await waitFor(()=>expect(mocks.finalize).toHaveBeenCalled());expect(mocks.signupVerify).toHaveBeenCalledWith({code:"123456"});expect(document.querySelector("#clerk-captcha")).not.toBeNull()});
 it("preserves MFA and account requirements with provider fallback",async()=>{await send();mocks.state.status="needs_second_factor";fireEvent.change(screen.getByLabelText("Verification code"),{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Verify and continue"}));await screen.findByText(/Secure additional verification/);expect(mocks.finalize).not.toHaveBeenCalled()});
 it("shows provider validation errors without pretending sign-in succeeded",async()=>{mocks.send.mockResolvedValueOnce({error:{message:"Code temporarily unavailable"}});render(<AuthForm mode="sign-in"/>);fireEvent.change(screen.getByLabelText("Email address"),{target:{value:"student@school.test"}});fireEvent.click(screen.getByRole("button",{name:"Email me a code"}));expect((await screen.findByRole("alert")).textContent).toContain("Code temporarily unavailable");expect(mocks.finalize).not.toHaveBeenCalled()});
 it("offers phone OTP only when explicitly enabled",async()=>{vi.stubEnv("NEXT_PUBLIC_CLERK_PHONE_AUTH_ENABLED","true");render(<AuthForm mode="sign-in"/>);fireEvent.change(screen.getByRole("combobox"),{target:{value:"phone"}});fireEvent.change(screen.getByLabelText("Phone number (with country code)"),{target:{value:"+2348123456789"}});fireEvent.click(screen.getByRole("button",{name:"Text me a code"}));await screen.findByLabelText("Verification code");expect(mocks.phoneSend).toHaveBeenCalledWith({phoneNumber:"+2348123456789"})});
});
