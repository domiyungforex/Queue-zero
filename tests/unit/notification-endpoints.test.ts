import { it,expect,vi } from "vitest";
vi.mock('server-only',()=>({}));
import { allowedPushEndpoint } from "@/lib/notifications/provider";
it.each(['https://fcm.googleapis.com/fcm/send/opaque','https://updates.push.services.mozilla.com/wpush/v2/opaque','https://web.push.apple.com/opaque','https://wns2.notify.windows.com/w/?token=opaque'])('allows supported browser push endpoints',endpoint=>expect(allowedPushEndpoint(endpoint)).toBe(true));
it.each(['http://fcm.googleapis.com/token','https://127.0.0.1/token','https://localhost/token','https://169.254.169.254/latest/meta-data','https://fcm.googleapis.com.evil.test/token','https://user:password@fcm.googleapis.com/token','https://fcm.googleapis.com:8443/token','file:///etc/passwd'])('blocks untrusted endpoints and SSRF destinations',endpoint=>expect(allowedPushEndpoint(endpoint)).toBe(false));
