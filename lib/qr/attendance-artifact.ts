export type AttendanceQrArtifact = { image: string; url: string; expires: number };

export function attendanceQrFilename(classLabel: string) {
  const label = classLabel.normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80).toLowerCase();
  return `turnmark-attendance-${label || "class"}.png`;
}

export function attendanceQrFile(artifact: AttendanceQrArtifact, classLabel: string) {
  const bytes = Uint8Array.from(atob(artifact.image.split(",")[1]), character => character.charCodeAt(0));
  return new File([bytes], attendanceQrFilename(classLabel), { type: "image/png" });
}

export function attendanceQrExpiry(expires: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(expires));
}

/** A separate print document keeps student records and dashboard UI off paper. */
export async function printAttendanceQr(artifact: AttendanceQrArtifact, classLabel: string, signal: AbortSignal) {
  if (signal.aborted || artifact.expires <= Date.now()) throw new Error("Attendance QR unavailable");
  const previousFocus = document.activeElement;
  const frame = document.createElement("iframe");
  frame.title = "Attendance QR print sheet";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;border:0;";
  document.body.append(frame);
  const remove = () => {
    const restoreFocus = document.activeElement === frame;
    frame.remove();
    signal.removeEventListener("abort", remove);
    if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  signal.addEventListener("abort", remove, { once: true });
  try {
    const doc = frame.contentDocument;
    const target = frame.contentWindow;
    if (!doc || !target) throw new Error("Print document unavailable");
    doc.title = "TuRnMaRk — Class attendance";
    const style = doc.createElement("style");
    style.textContent = `
      @page { size: auto; margin: 15mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111318; background: white; font: 14pt/1.4 system-ui, sans-serif; text-align: center; }
      main { max-width: 175mm; margin: auto; break-inside: avoid; }
      .brand { font-size: 22pt; font-weight: 800; color: #e65420; }
      h1 { margin: 6mm 0 3mm; font-size: 24pt; line-height: 1.15; overflow-wrap: anywhere; }
      h2 { margin: 3mm 0; font-size: 18pt; }
      img { display: block; width: 110mm; max-width: 100%; height: auto; margin: 4mm auto; }
      p { margin: 3mm 0; }
      .expiry { margin-top: 6mm; font-size: 11pt; }
      .note { color: #555; font-size: 10pt; }
    `;
    doc.head.append(style);
    const main = doc.createElement("main");
    const text = (tag: string, value: string, className?: string) => {
      const element = doc.createElement(tag);
      element.textContent = value;
      if (className) element.className = className;
      main.append(element);
    };
    text("p", "TuRnMaRk", "brand");
    text("h1", classLabel);
    text("h2", "Scan to mark attendance");
    const image = doc.createElement("img");
    image.alt = "QR code for this class attendance form";
    image.width = 1024;
    image.height = 1024;
    image.src = artifact.image;
    main.append(image);
    text("p", "Open your phone camera, scan the code, then enter your name and matric number.");
    text("p", "No account or advance registration required.", "note");
    text("p", `Available until ${attendanceQrExpiry(artifact.expires)}`, "expiry");
    text("p", "This code stops working when attendance closes, expires or is revoked.", "note");
    doc.body.replaceChildren(main);
    target.addEventListener("afterprint", remove, { once: true });
    await new Promise<void>((resolve, reject) => {
      const abort = () => finish(new Error("Printing cancelled"));
      const timer = setTimeout(() => finish(new Error("QR image unavailable")), 10_000);
      function finish(cause?: Error) {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (cause) reject(cause); else resolve();
      }
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      image.decode().then(() => finish(), () => finish(new Error("QR image unavailable")));
    });
    if (signal.aborted || artifact.expires <= Date.now()) throw new Error("Attendance QR unavailable");
    target.focus();
    target.print();
    // Safari can return before its dialog closes. Keep the image until afterprint
    // or component cleanup rather than removing it as soon as print() returns.
  } catch (cause) {
    remove();
    throw cause;
  }
}
