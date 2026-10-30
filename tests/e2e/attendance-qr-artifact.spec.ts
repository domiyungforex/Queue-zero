import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import ts from "typescript";
import { signAttendanceToken } from "../../lib/qr/signing";

// Isolated browser artifact tests, not authenticated staff-screen QA. No app
// routes, account bypass, database fixtures or hosted network access are used.
const artifactModule = ts.transpileModule(readFileSync(resolve("lib/qr/attendance-artifact.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const artifactDirectory = resolve("qa-output/attendance-qr-20261029");

async function artifact() {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const token = signAttendanceToken({
    version: 1, purpose: "CLASS_ATTENDANCE", organization_id: randomUUID(),
    session_id: randomUUID(), nonce: randomUUID(), issued_at: issuedAt, expires_at: issuedAt + 3_600,
  }, randomBytes(32).toString("hex"));
  const url = `http://localhost/attend?token=${token}`;
  return {
    url, expires: (issuedAt + 3_600) * 1_000,
    image: await QRCode.toDataURL(url, { width: 1024, margin: 4, errorCorrectionLevel: "M", color: { dark: "#111318", light: "#ffffff" } }),
  };
}

function decodedUrl(bytes: Buffer) {
  const png = PNG.sync.read(bytes);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

test.beforeEach(async ({ context }) => {
  mkdirSync(artifactDirectory, { recursive: true });
  await context.route(/^https?:\/\//, route => route.abort());
});

test("attendance print artifact decodes before printing, excludes roster data and fits one A4 page", async ({ page, context }) => {
  const qr = await artifact();
  await page.setContent("<h1>Isolated browser fixture</h1><nav>Dashboard navigation</nav><table><tr><td>PRIVATE ROSTER NAME AND MATRIC</td></tr></table>");
  const printed = await page.evaluate(async ({ source, qr }) => {
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const tools = await import(moduleUrl) as typeof import("../../lib/qr/attendance-artifact");
    URL.revokeObjectURL(moduleUrl);
    const append = document.body.append;
    let printCalls = 0;
    let imageDecoded = false;
    document.body.append = function (...nodes) {
      append.apply(this, nodes);
      for (const node of nodes) {
        if (node instanceof HTMLIFrameElement && node.contentWindow) {
          // Only the OS dialog is intercepted; DOM, iframe and image.decode are real.
          node.contentWindow.print = () => {
            printCalls++;
            const image = node.contentDocument?.querySelector("img");
            imageDecoded = Boolean(image?.complete && image.naturalWidth === 1024);
          };
        }
      }
    };
    try {
      await tools.printAttendanceQr(qr, "Local QR artifact test · QA 101", new AbortController().signal);
      const frame = document.querySelector("iframe")!;
      const doc = frame.contentDocument!;
      const result = { printCalls, imageDecoded, html: doc.documentElement.outerHTML,
        text: doc.body.textContent, png: doc.querySelector("img")!.src };
      frame.contentWindow!.dispatchEvent(new Event("afterprint"));
      return { ...result, framesAfterPrint: document.querySelectorAll("iframe").length };
    } finally { document.body.append = append; }
  }, { source: artifactModule, qr });

  expect(printed.printCalls).toBe(1);
  expect(printed.imageDecoded).toBe(true);
  expect(printed.framesAfterPrint).toBe(0);
  expect(printed.png).toBe(qr.image);
  expect(decodedUrl(Buffer.from(printed.png.split(",")[1], "base64"))).toBe(qr.url);
  expect(printed.text).toContain("Local QR artifact test · QA 101");
  expect(printed.text).toContain("Available until");
  expect(printed.text).not.toContain("PRIVATE ROSTER");
  expect(printed.text).not.toContain("Dashboard navigation");

  // Render the exact generated document under Chromium's print media and PDF
  // engine. These artifacts are labelled local tests, never production evidence.
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 794, height: 1123 });
  await sheet.setContent(printed.html);
  await sheet.emulateMedia({ media: "print" });
  await sheet.locator("img").evaluate(image => (image as HTMLImageElement).decode());
  const pdf = await sheet.pdf({ path: resolve(artifactDirectory, "isolated-attendance-print.pdf"), format: "A4", printBackground: true });
  expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  await sheet.screenshot({ path: resolve(artifactDirectory, "isolated-attendance-print.png"), fullPage: true });
  await sheet.close();
});

test("attendance PNG retains the signed URL after a real browser download", async ({ page }) => {
  const qr = await artifact();
  await page.setContent("<h1>Isolated QR download fixture</h1>");
  const downloadEvent = page.waitForEvent("download");
  await page.evaluate(async ({ source, qr }) => {
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const tools = await import(moduleUrl) as typeof import("../../lib/qr/attendance-artifact");
    URL.revokeObjectURL(moduleUrl);
    const download = document.createElement("a");
    download.download = tools.attendanceQrFilename("Local QR artifact test · QA 101");
    download.href = qr.image;
    document.body.append(download);
    download.click();
    download.remove();
  }, { source: artifactModule, qr });
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("turnmark-attendance-local-qr-artifact-test-qa-101.png");
  const file = resolve(artifactDirectory, download.suggestedFilename());
  await download.saveAs(file);
  const bytes = readFileSync(file);
  expect(bytes.equals(Buffer.from(qr.image.split(",")[1], "base64"))).toBe(true);
  expect(decodedUrl(bytes)).toBe(qr.url);
});
