import "server-only";
import webpush from "web-push";
export type Notice={title:string;body:string;url:string;tag:string};
export type PushTarget={endpoint:string;p256dh:string;auth:string};
export interface NotificationProvider {sendAlmostTurnNotification(target:PushTarget,notice:Notice):Promise<void>;sendCalledNotification(target:PushTarget,notice:Notice):Promise<void>;sendQueuePausedNotification(target:PushTarget,notice:Notice):Promise<void>}
export function allowedPushEndpoint(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
export class WebPushProvider implements NotificationProvider {
 private async send(target:PushTarget,notice:Notice){
  if(!allowedPushEndpoint(target.endpoint))throw new Error('Unsupported push provider');
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
  if(!publicKey||!privateKey||!subject)throw new Error('Web push is not configured');
  await webpush.sendNotification({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify(notice),{TTL:300,timeout:10000,vapidDetails:{subject,publicKey,privateKey}});
 }
 sendAlmostTurnNotification(t:PushTarget,n:Notice){return this.send(t,n)}
 sendCalledNotification(t:PushTarget,n:Notice){return this.send(t,n)}
 sendQueuePausedNotification(t:PushTarget,n:Notice){return this.send(t,n)}
}
/** Credentials/templates must be configured before enabling these channels. */
export class SmsProvider implements NotificationProvider {
 async sendAlmostTurnNotification():Promise<void>{throw new Error('SMS delivery is not configured')}
 async sendCalledNotification():Promise<void>{throw new Error('SMS delivery is not configured')}
 async sendQueuePausedNotification():Promise<void>{throw new Error('SMS delivery is not configured')}
}
export class WhatsAppProvider extends SmsProvider {
 override async sendAlmostTurnNotification():Promise<void>{throw new Error('WhatsApp templates are not configured')}
 override async sendCalledNotification():Promise<void>{throw new Error('WhatsApp templates are not configured')}
 override async sendQueuePausedNotification():Promise<void>{throw new Error('WhatsApp templates are not configured')}
}
