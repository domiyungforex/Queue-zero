// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {act,cleanup,render,screen} from "@testing-library/react";
vi.mock("qrcode",()=>({default:{toDataURL:vi.fn(async()=>"data:image/png;base64,test")}}));
vi.mock("next/image",()=>({default:({alt}: {alt: string})=><span role="img" aria-label={alt}/>}));
import {AttendanceQr} from "@/components/school/attendance-qr";
import {classId} from "./school-fixture";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
describe("stable attendance display",()=>{
 it("keeps one class QR instead of polling for rotating tokens",async()=>{vi.useFakeTimers();const now=Date.now();const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({url:"https://turnmark.test/attend?token=valid",expiresAt:new Date(now+60*60*1000).toISOString()})});vi.stubGlobal("fetch",fetcher);await act(async()=>{render(<AttendanceQr classId={classId}/>);});expect(screen.getByLabelText("QR code for this class attendance form")).toBeTruthy();await act(async()=>{vi.advanceTimersByTime(31000);});expect(screen.getByLabelText("QR code for this class attendance form")).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);});
 it("does not display expired server tokens",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({url:"https://turnmark.test/attend?token=expired",expiresAt:new Date(Date.now()-1000).toISOString()})}));await act(async()=>{render(<AttendanceQr classId={classId}/>);});expect(screen.queryByLabelText("QR code for this class attendance form")).toBeNull();expect(screen.getByRole("button",{name:"Retry QR"})).toBeTruthy();});
});
