// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {act,cleanup,render,screen} from "@testing-library/react";
vi.mock("qrcode",()=>({default:{toDataURL:vi.fn(async()=>"data:image/png;base64,test")}}));
vi.mock("next/image",()=>({default:({alt}: {alt: string})=><span role="img" aria-label={alt}/>}));
import {AttendanceQr} from "@/components/school/attendance-qr";
import {classId} from "./school-fixture";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
describe("rotating attendance display",()=>{
 it("removes a QR immediately when its validity expires during a stalled rotation",async()=>{vi.useFakeTimers();const now=Date.now();const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({url:"https://queuezero.test/attend?token=valid",expiresAt:new Date(now+30000).toISOString()})}).mockImplementation(()=>new Promise(()=>{}));vi.stubGlobal("fetch",fetcher);await act(async()=>{render(<AttendanceQr classId={classId}/>);});expect(screen.getByLabelText("Rotating QR for this class attendance")).toBeTruthy();await act(async()=>{vi.advanceTimersByTime(31000);});expect(screen.queryByLabelText("Rotating QR for this class attendance")).toBeNull();expect(screen.getByText("Refreshing expired QR…")).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(2);});
 it("does not display expired server tokens",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({url:"https://queuezero.test/attend?token=expired",expiresAt:new Date(Date.now()-1000).toISOString()})}));await act(async()=>{render(<AttendanceQr classId={classId}/>);});expect(screen.queryByLabelText("Rotating QR for this class attendance")).toBeNull();expect(screen.getByRole("button",{name:"Retry QR"})).toBeTruthy();});
});
