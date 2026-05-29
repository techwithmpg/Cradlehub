import { CrmPanel } from "@/components/features/crm/today/crm-panel";

export function SchedulePanel({
  title,
  action,
  children,
  className = "",
  style,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <CrmPanel title={title} action={action} className={className} style={style}>
      {children}
    </CrmPanel>
  );
}
