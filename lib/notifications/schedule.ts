import "server-only";
import { after } from "next/server";
import { deliverNotifications } from "./deliver";
/** Delivery must never change the result of a committed queue operation. */
export function scheduleNotifications(){try{after(async()=>{try{await deliverNotifications()}catch{console.warn('QueueZero notification delivery deferred')}})}catch{console.warn('QueueZero notification worker unavailable; outbox retained')}}
