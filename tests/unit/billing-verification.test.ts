import { beforeEach,afterEach,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({single:vi.fn(),rpc:vi.fn(),eq:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db/join-server',()=>({createJoinSupabaseClient:()=>({from:()=>({select:()=>({eq:mocks.eq})}),rpc:mocks.rpc})}));
import { verifyCheckout } from "@/lib/paystack/server";
const ref='b1000000-0000-4000-8000-000000000099';
const paid={id:1,reference:ref,status:'success',amount:10000,currency:'NGN',paid_at:'2026-10-02T12:00:00Z',customer:{customer_code:'CUS_fixture'},plan:{plan_code:'PLN_fixture'}};
beforeEach(()=>{vi.stubEnv('PAYSTACK_SECRET_KEY','sk_test_fixture');mocks.eq.mockImplementation(()=>({eq:mocks.eq,single:mocks.single}));mocks.single.mockResolvedValue({data:{reference:ref,amount:10000,currency:'NGN',provider_plan_code:'PLN_fixture'},error:null});mocks.rpc.mockResolvedValue({error:null})});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
function reply(data:unknown){vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({status:true,data}),{headers:{'Content-Type':'application/json'}})))}
it('only applies a provider-verified payment matching the stored checkout',async()=>{reply(paid);expect(await verifyCheckout(ref,'business_fixture')).toBe(true);expect(mocks.eq).toHaveBeenCalledWith('business_id','business_fixture');expect(mocks.rpc).toHaveBeenCalledWith('confirm_checkout',expect.objectContaining({p_reference:ref,p_event_id:'charge:1'}))});
it.each([{amount:1},{currency:'USD'},{plan:{plan_code:'PLN_other'}},{reference:'another-reference'},{paid_at:null}])('rejects mismatched payment fields',async bad=>{reply({...paid,...bad});await expect(verifyCheckout(ref)).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled()});
it('never activates a browser-returned pending transaction',async()=>{reply({...paid,status:'pending'});expect(await verifyCheckout(ref)).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled()});
it('rejects unknown or foreign checkout before provider verification',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);mocks.single.mockResolvedValue({data:null,error:{code:'PGRST116'}});await expect(verifyCheckout(ref,'foreign-business')).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled()});
