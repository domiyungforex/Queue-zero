"use client";
import { useEffect,useRef } from "react";
export function Confirmation({onDismiss,children}:{onDismiss:()=>void;children:React.ReactNode}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);return <dialog ref={ref} onCancel={onDismiss} onClick={event=>{if(event.target===event.currentTarget)onDismiss()}} className="confirmation-dialog" aria-labelledby="confirm-title">{children}</dialog>}
