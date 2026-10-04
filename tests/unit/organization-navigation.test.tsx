// @vitest-environment jsdom
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { DashboardNavigation } from '@/components/dashboard/navigation';
vi.mock('next/navigation',()=>({usePathname:()=>'/dashboard'}));
afterEach(cleanup);
describe('organization navigation capabilities',()=>{
 it('keeps queues prominent while exposing teaching tools only in school modes',()=>{
  render(<DashboardNavigation role="owner" mode="SCHOOL"/>);
  expect(screen.getByRole('link',{name:'Queues'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Courses'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Students'})).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Billing'})).toBeNull();
 });
 it('does not grant lecturer access to team, billing or settings',()=>{
  render(<DashboardNavigation role="lecturer" mode="SCHOOL"/>);
  expect(screen.getByRole('link',{name:'Attendance'})).toBeTruthy();
  for(const name of ['Team','Billing','Settings','Locations'])expect(screen.queryByRole('link',{name})).toBeNull();
 });
 it('keeps ordinary business focused on queues and actual customer visits',()=>{
  render(<DashboardNavigation role="owner"/>);
  expect(screen.getByRole('link',{name:'Customers'})).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Attendance'})).toBeNull();
 });
 it('does not expose a staff workspace to students',()=>{
  render(<DashboardNavigation role="student" mode="SCHOOL"/>);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
 });
});
