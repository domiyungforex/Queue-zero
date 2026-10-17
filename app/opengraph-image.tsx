import { ImageResponse } from "next/og";
export const alt = "TuRnMaRk — Scan. Join. Leave the line.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() { return new ImageResponse(<div style={{ background: "#111318", color: "white", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px", width: "100%", height: "100%" }}><div style={{ fontSize: 42, color: "#ff6b2b" }}>TuRnMaRk</div><div style={{ display: "flex", flexDirection: "column", fontSize: 78, fontWeight: 700 }}><span>People flow better</span><span style={{ color: "#ff4765" }}>with TuRnMaRk.</span></div><div style={{ fontSize: 30, color: "#fffaf7" }}>Scan. Join. Leave the line.</div></div>, size); }
