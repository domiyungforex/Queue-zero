// @vitest-environment jsdom
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { DashboardNavigation } from '@/components/dashboard/navigation';
vi.mock('next/navigation',()=>({usePathname:()=>'/dashboard'}));
afterEach(cleanup);
describe('organization navigation capabilities',()=>{
 it('gives an individual lecturer the teaching workflow and attendance reports',()=>{
  render(<DashboardNavigation role="owner" mode="SCHOOL" workspaceOwnership="INDIVIDUAL" professionalCategory="LECTURER_TEACHER"/>);
  for(const name of ['Courses','Classes','Attendance','Students','Reports'])expect(screen.getByRole('link',{name})).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Queues'})).toBeNull();
 });
 it('keeps queues prominent while exposing education tools to school organization owners',()=>{
  render(<DashboardNavigation role="owner" mode="SCHOOL" workspaceOwnership="ORGANIZATION" organizationType="UNIVERSITY_SCHOOL"/>);
  expect(screen.getByRole('link',{name:'Queues'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Courses'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Students'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Staff & roles'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Billing'})).toBeTruthy();
 });
 it('does not grant lecturer access to team, billing or settings',()=>{
  render(<DashboardNavigation role="lecturer" mode="SCHOOL" workspaceOwnership="ORGANIZATION"/>);
  expect(screen.getByRole('link',{name:'Attendance'})).toBeTruthy();
  for(const name of ['Staff & roles','Billing','Settings','Locations'])expect(screen.queryByRole('link',{name})).toBeNull();
 });
 it('shows staff management only when an institution unit grants it',()=>{
  const {rerender}=render(<DashboardNavigation role="staff" workspaceOwnership="ORGANIZATION" institution/>);
  expect(screen.queryByRole('link',{name:'Staff & roles'})).toBeNull();
  rerender(<DashboardNavigation role="staff" workspaceOwnership="ORGANIZATION" institution institutionStaffManagement/>);
  expect(screen.getByRole('link',{name:'Staff & roles'})).toBeTruthy();
 });
 it('keeps ordinary business focused on queues and actual customer visits',()=>{
  render(<DashboardNavigation role="owner" workspaceOwnership="ORGANIZATION"/>);
  expect(screen.getByRole('link',{name:'Staff & roles'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Reports'})).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Attendance'})).toBeNull();
 });
 it('does not expose a staff workspace to students',()=>{
  render(<DashboardNavigation role="student" mode="SCHOOL" workspaceOwnership="ORGANIZATION"/>);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
 });
});
