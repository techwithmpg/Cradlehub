import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { WorkflowTask } from "@/lib/notifications/types";

type Props = {
  title: string;
  tasks: WorkflowTask[];
};

function taskLabel(taskType: string, count: number): string {
  if (taskType === "staff_onboarding.review") {
    return `${count} staff approval${count === 1 ? "" : "s"}`;
  }
  return `${count} ${taskType.replace(/[_.-]+/g, " ")}`;
}

function buildSummary(tasks: WorkflowTask[]): string {
  const counts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.task_type] = (acc[task.task_type] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([type, count]) => taskLabel(type, count))
    .join(" / ");
}

export function WorkspaceAttentionStrip({ title, tasks }: Props) {
  if (!tasks.length) return null;

  const firstHref = tasks.find((task) => task.action_href)?.action_href;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "10px 14px",
        marginBottom: "1rem",
        borderRadius: "var(--cs-r-md)",
        background: "var(--cs-sand-mist)",
        border: "1px solid rgba(200,169,107,0.32)",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--cs-r-xs)",
          background: "rgba(200,169,107,0.16)",
          color: "var(--cs-sand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Sparkles size={15} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: "0.8125rem", color: "var(--cs-text)" }}>
        <span style={{ fontWeight: 700 }}>{title}: </span>
        <span style={{ color: "var(--cs-text-muted)" }}>{buildSummary(tasks)}</span>
      </div>
      {firstHref && (
        <Link
          href={firstHref}
          style={{
            flexShrink: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--cs-brand)",
            textDecoration: "none",
          }}
        >
          Review
        </Link>
      )}
    </div>
  );
}
