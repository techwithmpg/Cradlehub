"use client";

export function DatePickerForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form method="GET">
      <input
        type="date"
        name="date"
        defaultValue={defaultValue}
        style={{
          height: 36,
          borderRadius: 8,
          border: "1px solid var(--cs-border)",
          backgroundColor: "var(--cs-surface)",
          color: "var(--cs-text)",
          padding: "0 0.75rem",
          fontSize: "0.875rem",
        }}
        onChange={(e) => {
          const form = e.currentTarget.form;
          if (form) form.submit();
        }}
      />
    </form>
  );
}
