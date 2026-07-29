import {
  createQrPosterContent,
  qrSvgDataUri,
  toQrPrintPoint,
  type QrPosterContent,
  type QrPrintFormat,
} from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint } from "@/lib/attendance/types";

export function CradlePrintHeader() {
  return (
    <header className="cradle-print-header">
      <p className="cradle-print-wordmark">CRADLE</p>
      <p className="cradle-print-tagline">WELLNESS LIVING</p>
    </header>
  );
}

export function CradlePrintDivider() {
  return (
    <div className="cradle-print-divider" aria-hidden="true">
      <span className="cradle-print-mark">
        <i />
      </span>
    </div>
  );
}

export function CradleQrFrame({ content }: { content: QrPosterContent }) {
  return (
    <div className="cradle-qr-frame">
      {/* The generated SVG data URI must stay byte-stable and print without an optimizer request. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSvgDataUri(content.qrSvg)} alt={`${content.title} QR code`} />
    </div>
  );
}

export function CradlePrintFooter({ branchName }: { branchName: string }) {
  return (
    <footer className="cradle-print-footer">
      <strong>{branchName.toUpperCase()}</strong>
      <span className="cradle-footer-mark" aria-hidden="true">
        <i />
      </span>
    </footer>
  );
}

function PosterHeading({ content }: { content: QrPosterContent }) {
  return (
    <div className="cradle-print-heading">
      <h1>{content.title}</h1>
      {content.subtitle ? <p>{content.subtitle}</p> : null}
      {content.capacityLabel || content.statusLabel ? (
        <div className="cradle-print-meta">
          {content.capacityLabel ? <span>{content.capacityLabel}</span> : null}
          {content.statusLabel ? (
            <span className="cradle-print-status" data-state={content.statusLabel.toLowerCase()}>
              {content.statusLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PosterGuidance({ content }: { content: QrPosterContent }) {
  if (content.kind === "room") {
    return (
      <div className="cradle-guidance cradle-guidance--room">
        <ol>
          {content.guidance.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="cradle-guidance cradle-guidance--attendance">
      <ul>
        {content.guidance.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function CradlePrintPage({
  content,
  format,
}: {
  content: QrPosterContent;
  format: QrPrintFormat;
}) {
  return (
    <article
      className="cradle-print-page"
      data-kind={content.kind}
      data-format={format}
      aria-label={`${content.title} poster for ${content.branchName}`}
    >
      <div className="cradle-print-content">
        <CradlePrintHeader />
        <PosterHeading content={content} />
        <CradlePrintDivider />
        <CradleQrFrame content={content} />
        <div className="cradle-primary-instructions">
          {content.primaryInstructions.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <PosterGuidance content={content} />
        <p className="cradle-print-distinction">{content.distinction}</p>
      </div>
      <CradlePrintFooter branchName={content.branchName} />
    </article>
  );
}

export function AttendanceQrPoster({
  qrPoint,
  branchName,
  format,
}: {
  qrPoint: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  const content = createQrPosterContent(toQrPrintPoint(qrPoint, branchName));
  return <CradlePrintPage content={content} format={format} />;
}

export function RoomQrPoster({
  qrPoint,
  branchName,
  format,
}: {
  qrPoint: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  const content = createQrPosterContent(toQrPrintPoint(qrPoint, branchName));
  return <CradlePrintPage content={content} format={format} />;
}

export function CradleQrPoster({
  qrPoint,
  branchName,
  format,
}: {
  qrPoint: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  return qrPoint.point_type === "attendance" ? (
    <AttendanceQrPoster qrPoint={qrPoint} branchName={branchName} format={format} />
  ) : (
    <RoomQrPoster qrPoint={qrPoint} branchName={branchName} format={format} />
  );
}

export function QrPrintDocument({
  points,
  branchName,
  format,
}: {
  points: readonly AttendanceQrPoint[];
  branchName: string;
  format: QrPrintFormat;
}) {
  return (
    <main className="cradle-print-document">
      {points.map((point) => (
        <CradleQrPoster key={point.id} qrPoint={point} branchName={branchName} format={format} />
      ))}
    </main>
  );
}
