import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({role:'lecturer',mode:'SCHOOL'}));
vi.mock('server-only',()=>({}));
vi.mock('react',async importOriginal=>({...await importOriginal<typeof import('react')>(),cache:<T>(fn:T)=>fn}));
vi.mock('@/lib/auth/server',()=>({requireUserId:async()=>'user_member'}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`)}}));
vi.mock('@/lib/db/server',()=>({createUserSupabaseClient:async()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:async()=>({data:[{business_id:'org',role:mocks.role,businesses:{name:'School',organization_mode:mocks.mode,workspace_ownership:'INDIVIDUAL',professional_category:'LECTURER_TEACHER'}}],error:null})})})})})})}));
import { requireBusinessManager,getCurrentMembership } from '@/lib/business/membership';
beforeEach(()=>{mocks.role='lecturer';mocks.mode='SCHOOL'});
describe('organization membership boundaries',()=>{
 it.each(['staff','lecturer','student'])('denies %s manager privileges',async role=>{mocks.role=role;await expect(requireBusinessManager()).rejects.toThrow('redirect:/dashboard')});
 it.each(['owner','admin'])('permits %s manager privileges',async role=>{mocks.role=role;expect((await requireBusinessManager()).role).toBe(role)});
 it('derives organization mode from verified membership database relationship',async()=>{expect((await getCurrentMembership())?.organizationMode).toBe('SCHOOL')});
 it('derives workspace ownership from the authorized membership relationship',async()=>{expect(await getCurrentMembership()).toMatchObject({workspaceOwnership:'INDIVIDUAL',professionalCategory:'LECTURER_TEACHER'})});
});
