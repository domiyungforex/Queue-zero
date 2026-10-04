import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn()}));
vi.mock('@/lib/auth/server',()=>({requireUserId:mocks.user}));
vi.mock('@/lib/db/server',()=>({createUserSupabaseClient:async()=>({rpc:mocks.rpc})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(path)},unstable_rethrow:vi.fn()}));
import { onboardBusiness } from '@/app/onboarding/actions';
function form(mode:string){const form=new FormData();for(const [key,value]of Object.entries({organizationMode:mode,businessName:'School',industry:'education',country:'NG',timezone:'Africa/Lagos',locationName:'Campus',locationAddress:'Main campus'}))form.set(key,value);return form;}
beforeEach(()=>{mocks.rpc.mockReset().mockResolvedValue({data:'ac000000-0000-4000-8000-000000000001',error:null});mocks.user.mockReset().mockResolvedValue('user_owner')});
describe('organization onboarding',()=>{
 it.each(['SCHOOL','HYBRID'])('creates %s atomically with authorized organization RPC',async mode=>{
  await expect(onboardBusiness({status:'idle'},form(mode))).rejects.toThrow('/dashboard');
  expect(mocks.rpc).toHaveBeenCalledWith('onboard_organization',expect.objectContaining({p_mode:mode,p_business_name:'School'}));
 });
 it('rejects invalid capability modes without touching the database',async()=>{
  expect((await onboardBusiness({status:'idle'},form('ADMIN'))).status).toBe('error');
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
