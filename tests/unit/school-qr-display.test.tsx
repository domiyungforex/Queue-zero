// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
vi.mock("qrcode",()=>({default:{toDataURL:vi.fn(async()=>"data:image/png;base64,test")}}));
vi.mock("next/image",()=>({default:({alt}: {alt: string})=><span role="img" aria-label={alt}/>})); 
import {AttendanceQr} from "@/components/school/attendance-qr";
import {classId} from "./school-fixture";

afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe("stable attendance display",()=>{
  it("loads once and does not auto-refresh",async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({
      url:"https://queuezero.test/attend?token=valid",
      expiresAt:new Date(Date.now()+60*60*1000).toISOString(),
    })});
    vi.stubGlobal("fetch",fetcher);
    await act(async()=>{render(<AttendanceQr classId={classId}/>);});
    await screen.findByLabelText("QR for this class attendance");
    await new Promise(resolve=>setTimeout(resolve,25));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/stays the same until you regenerate it or end the class/i)).toBeTruthy();
  });

  it("regenerates only after lecturer action",async()=>{
    const fetcher=vi.fn()
      .mockResolvedValueOnce({ok:true,json:async()=>({
        url:"https://queuezero.test/attend?token=first",
        expiresAt:new Date(Date.now()+60*60*1000).toISOString(),
      })})
      .mockResolvedValueOnce({ok:true,json:async()=>({
        url:"https://queuezero.test/attend?token=second",
        expiresAt:new Date(Date.now()+60*60*1000).toISOString(),
      })});
    vi.stubGlobal("fetch",fetcher);
    render(<AttendanceQr classId={classId}/>);
    await screen.findByLabelText("QR for this class attendance");
    fireEvent.click(screen.getByRole("button",{name:"Regenerate QR"}));
    await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("does not display expired server tokens",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:true,
      json:async()=>({
        url:"https://queuezero.test/attend?token=expired",
        expiresAt:new Date(Date.now()-1000).toISOString(),
      }),
    }));
    render(<AttendanceQr classId={classId}/>);
    await screen.findByText(/QR unavailable/i);
    expect(screen.queryByLabelText("QR for this class attendance")).toBeNull();
    expect(screen.getByRole("button",{name:"Retry QR"})).toBeTruthy();
  });
});
