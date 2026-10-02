"use client";
import Link from "next/link";
import { RefreshCw,ArrowLeft } from "lucide-react";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main id="main" className="loading-screen"><span className="tile-icon"><RefreshCw/></span><h1>A small interruption.</h1><p>We couldn’t load this page. Your saved queue data is still safe. Please try again.</p><div className="button-row"><button onClick={reset} className="button-primary">Try again<RefreshCw size={17}/></button><Link href="/" className="button-secondary"><ArrowLeft size={17}/>Return home</Link></div></main>}
