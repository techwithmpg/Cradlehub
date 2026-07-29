import { getQrPrintLayout, type QrPrintFormat } from "@/lib/attendance/qr-print-layout";

const CRADLE_QR_POSTER_CSS = `
.cradle-print-page,.cradle-print-page *{box-sizing:border-box}
.cradle-print-document{display:grid;justify-items:center;gap:24px;padding:24px}
.cradle-print-page{--cream:#FCF7EC;--forest:#0F4D2F;--footer:#0B5634;--gold:#C79A3F;--gold-light:#E6BE60;position:relative;width:100%;aspect-ratio:210/297;overflow:hidden;container-type:inline-size;background:var(--cream);color:var(--forest);font-family:Arial,Helvetica,sans-serif;box-shadow:0 14px 36px rgba(31,51,39,.16);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cradle-print-page::before{content:"";position:absolute;z-index:1;inset:2.25cqw;border:.18cqw solid rgba(199,154,63,.38);border-radius:1.15cqw;pointer-events:none}
.cradle-print-content{position:relative;z-index:2;display:flex;height:100%;flex-direction:column;align-items:center;padding:10.2cqw 7.5cqw 13.5cqw;text-align:center}
.cradle-print-header{display:grid;justify-items:center}
.cradle-print-wordmark{margin:0;font:500 3.55cqw/1 Georgia,"Times New Roman",serif;letter-spacing:.62cqw;color:#B4822C}
.cradle-print-tagline{margin:1.45cqw 0 0;font-size:1.18cqw;line-height:1;letter-spacing:.55cqw;color:var(--gold)}
.cradle-print-heading{display:grid;max-width:88cqw;justify-items:center;margin-top:2.7cqw}
.cradle-print-heading h1{margin:0;font:700 5.05cqw/1.04 Georgia,"Times New Roman",serif;letter-spacing:.1cqw;color:var(--forest);text-wrap:balance}
.cradle-print-heading p{margin:1.05cqw 0 0;font-size:1.45cqw;font-weight:700;letter-spacing:.55cqw;color:var(--forest)}
.cradle-print-meta{display:flex;align-items:center;justify-content:center;gap:1.2cqw;margin-top:1.25cqw;font-size:1.35cqw;font-weight:700;letter-spacing:.1cqw;color:#94651F}
.cradle-print-status{border:.14cqw solid currentColor;border-radius:999px;padding:.45cqw 1.2cqw;font-size:1.05cqw;letter-spacing:.16cqw}
.cradle-print-status[data-state="inactive"]{color:#A23C32}
.cradle-print-divider{display:grid;width:67cqw;grid-template-columns:1fr 8cqw 1fr;align-items:center;gap:2.8cqw;margin-top:2.6cqw;color:var(--gold)}
.cradle-print-divider::before,.cradle-print-divider::after{content:"";height:.2cqw;background:currentColor}
.cradle-print-mark{position:relative;display:block;width:8cqw;height:4.8cqw}
.cradle-print-divider>.cradle-print-mark{grid-column:2}
.cradle-print-mark::before,.cradle-print-mark::after{content:"";position:absolute;top:.4cqw;width:4.5cqw;height:2.4cqw;background:currentColor}
.cradle-print-mark::before{right:50%;border-radius:100% 0 100% 0;transform:rotate(18deg);transform-origin:right bottom}
.cradle-print-mark::after{left:50%;border-radius:0 100% 0 100%;transform:rotate(-18deg);transform-origin:left bottom}
.cradle-print-mark i{position:absolute;z-index:2;left:50%;top:0;width:.55cqw;height:4.8cqw;border-radius:100%;background:currentColor;transform:translateX(-50%);clip-path:polygon(50% 0,100% 45%,52% 100%,0 45%)}
.cradle-qr-frame{display:grid;width:36.7cqw;aspect-ratio:1;place-items:center;border:.22cqw solid var(--gold);border-radius:1.25cqw;background:#FFF;padding:1.7cqw}
.cradle-qr-frame img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto}
.cradle-print-page[data-kind="attendance"] .cradle-qr-frame{margin-top:9.4cqw}
.cradle-print-page[data-kind="room"] .cradle-qr-frame{margin-top:4.3cqw}
.cradle-primary-instructions{display:grid;gap:.05cqw;margin-top:2.45cqw;font:700 3.75cqw/1.06 Georgia,"Times New Roman",serif;color:var(--forest)}
.cradle-print-page[data-kind="room"] .cradle-primary-instructions{font-size:2.65cqw;line-height:1.15}
.cradle-guidance{width:min(79cqw,100%);margin:2.05cqw 0 0;color:#365A46;text-align:left}
.cradle-guidance ul,.cradle-guidance ol{margin:0;padding:0;list-style-position:inside}
.cradle-guidance li{font-size:1.34cqw;line-height:1.45}
.cradle-guidance--attendance ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45cqw 2.4cqw;list-style:none;text-align:center}
.cradle-guidance--room ol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5cqw 2.6cqw;counter-reset:room-step;list-style:none}
.cradle-guidance--room li{position:relative;padding-left:2.35cqw;counter-increment:room-step}
.cradle-guidance--room li::before{content:counter(room-step) ".";position:absolute;left:0;font-weight:800;color:var(--forest)}
.cradle-print-distinction{margin:1.8cqw 0 0;border:.12cqw solid rgba(15,77,47,.28);border-radius:999px;padding:.75cqw 1.8cqw;font-size:1.32cqw;font-weight:700;letter-spacing:.03cqw;color:var(--forest)}
.cradle-print-footer{position:absolute;z-index:3;right:0;bottom:0;left:0;display:grid;height:11.1cqw;place-items:center;background:var(--footer);color:var(--gold-light)}
.cradle-print-footer strong{max-width:78cqw;overflow:hidden;font:700 3.35cqw/1 Georgia,"Times New Roman",serif;letter-spacing:.42cqw;text-overflow:ellipsis;white-space:nowrap}
.cradle-footer-mark{position:absolute;right:5.2cqw;top:50%;width:6.6cqw;height:5.1cqw;transform:translateY(-50%)}
.cradle-footer-mark::before,.cradle-footer-mark::after{content:"";position:absolute;top:.25cqw;width:3.75cqw;height:2.15cqw;background:currentColor}
.cradle-footer-mark::before{right:50%;border-radius:100% 0 100% 0;transform:rotate(18deg)}
.cradle-footer-mark::after{left:50%;border-radius:0 100% 0 100%;transform:rotate(-18deg)}
.cradle-footer-mark i{position:absolute;left:50%;top:1.1cqw;width:.52cqw;height:3.75cqw;border-radius:100%;background:currentColor;transform:translateX(-50%);clip-path:polygon(50% 0,100% 42%,52% 100%,0 42%)}
.cradle-print-controls{display:flex;gap:8px}
@media(max-width:680px){.cradle-print-document{gap:12px;padding:12px}}
`;

export function getCradleQrPrintCss(format: QrPrintFormat): string {
  const layout = getQrPrintLayout(format);
  return `${CRADLE_QR_POSTER_CSS}
@page{size:${layout.widthMm}mm ${layout.heightMm}mm;margin:0}
@media print{
  html,body{width:${layout.widthMm}mm;height:auto;margin:0;overflow:visible;background:#FFF}
  .cradle-print-document{display:block;width:${layout.widthMm}mm;margin:0;padding:0;gap:0}
  .cradle-print-page{display:block;width:${layout.widthMm}mm;height:${layout.heightMm}mm;min-height:${layout.heightMm}mm;margin:0;aspect-ratio:auto;break-before:auto;break-after:auto;break-inside:avoid-page;page-break-before:auto;page-break-after:auto;page-break-inside:avoid;box-shadow:none}
  .cradle-print-page+.cradle-print-page{break-before:page;page-break-before:always}
  .cradle-print-controls,[data-print-control]{display:none!important}
}`;
}
