// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
vi.mock("@/lib/school/actions",()=>({manageSchool:vi.fn()}));
import {ClassControls} from "@/components/school/forms";
import {schoolFixture} from "./school-fixture";
afterEach(cleanup);
describe("attendance control states",()=>{
 it("never offers mutations for a completed official register",()=>{render(<ClassControls session={schoolFixture().classes[0]}/>);expect(screen.queryByRole("button")).toBeNull();expect(screen.getByRole("status").textContent).toContain("ended");});
 it("offers only start for a draft and confirms destructive class completion",()=>{const session=schoolFixture().classes[0];session.status="DRAFT";const view=render(<ClassControls session={session}/>);expect(screen.getByRole("button",{name:"Start attendance"})).toBeTruthy();expect(screen.queryByRole("button",{name:"Enable checkout"})).toBeNull();session.status="OPEN";session.arrival_open=true;session.checkout_enabled=false;view.rerender(<ClassControls session={session}/>);expect(screen.getByRole("button",{name:"Close check-in"})).toBeTruthy();expect(screen.getByRole("button",{name:"Enable checkout"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"End session"}));expect(screen.getByRole("button",{name:"Confirm end session"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Keep class open"}));expect(screen.queryByRole("button",{name:"Confirm end session"})).toBeNull();});
});
