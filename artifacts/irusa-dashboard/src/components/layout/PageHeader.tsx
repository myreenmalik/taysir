import { ReactNode } from "react";

type PageHeaderProps = {
  /** Section number, e.g. "01" */
  number: string;
  /** Short page label shown next to the number, e.g. "Dashboard" */
  eyebrow: string;
  /** Big editorial title, e.g. "Dashboard." */
  title: string;
  /** Arabic translation displayed next to title, e.g. "لوحة القيادة" */
  arabic?: string;
  /** Subtitle / description sentence */
  subtitle?: string;
  /** Right-side small meta text, e.g. a date or volume tag */
  meta?: string;
  /** Right-side actions area (buttons, etc.) */
  actions?: ReactNode;
};

export function PageHeader({
  number,
  eyebrow,
  title,
  arabic,
  subtitle,
  meta,
  actions,
}: PageHeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="mb-10">
      {/* Top meta row */}
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium mb-4">
        <span>
          {number} <span className="text-muted-foreground/60 mx-1">/</span>{" "}
          {eyebrow}
        </span>
        <span>{meta ?? today}</span>
      </div>

      {/* Top divider */}
      <div className="h-px bg-foreground/15 mb-8" />

      {/* Title row */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <div className="flex items-baseline gap-4 flex-wrap">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1] text-foreground">
              {title}
              <span className="text-primary">.</span>
            </h1>
            {arabic && (
              <span
                lang="ar"
                dir="rtl"
                className="font-arabic text-3xl sm:text-4xl font-normal text-muted-foreground/50"
              >
                {arabic}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-4 text-base text-muted-foreground max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
