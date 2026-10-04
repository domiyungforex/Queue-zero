import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({owner:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/business/membership',()=>({requireBusinessOwner:mocks.owner,requireBusinessManager:vi.fn()}));
vi.mock('@/lib/db/server',()=>({createUserSupabaseClient:async()=>({rpc:mocks.rpc})}));
vi.mock('@clerk/nextjs/server',()=>({clerkClient:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({unstable_rethrow:vi.fn()}));
import { saveOrganizationMode } from '@/app/dashboard/settings/actions';
function form(mode:string){const form=new FormData();form.set('mode',mode);form.set('organization_id','victim-organization');return form;}
beforeEach(()=>{mocks.owner.mockReset().mockResolvedValue({businessId:'verified-organization'});mocks.rpc.mockReset().mockResolvedValue({error:null})});
describe('organization settings capability boundaries',()=>{
 it('uses owner membership organization, never posted identity',async()=>{
  expect((await saveOrganizationMode({ok:false,message:''},form('HYBRID'))).ok).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith('set_organization_mode',{p_organization_id:'verified-organization',p_mode:'HYBRID'});
 });
 it('denies nonowners before parsing or mutation',async()=>{
  mocks.owner.mockRejectedValue(new Error('Unauthorized'));
  await expect(saveOrganizationMode({ok:false,message:''},form('SCHOOL'))).rejects.toThrow('Unauthorized');
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('rejects forged capability names',async()=>{
  expect((await saveOrganizationMode({ok:false,message:''},form('ADVANCED_VERIFICATION'))).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('does not expose database errors',async()=>{
  mocks.rpc.mockResolvedValue({error:{message:'private database details'}});
  const result=await saveOrganizationMode({ok:false,message:''},form('SCHOOL'));
  expect(result.ok).toBe(false);expect(result.message).not.toContain('private');
 });
});
