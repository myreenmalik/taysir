import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Mail } from "lucide-react";

interface SendEmailButtonProps extends Omit<ButtonProps, "onClick"> {
  email: string | null | undefined;
  subject: string;
  body: string;
  label?: string;
  noEmailTooltip?: string;
}

export function SendEmailButton({
  email,
  subject,
  body,
  label = "Send email",
  noEmailTooltip = "No email address on file for this donor.",
  size = "sm",
  variant = "outline",
  className,
  ...buttonProps
}: SendEmailButtonProps) {
  const trimmed = email?.trim();
  const hasEmail = !!trimmed;

  if (!hasEmail) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              type="button"
              size={size}
              variant={variant}
              className={className}
              disabled
              aria-disabled="true"
              {...buttonProps}
            >
              <Mail className="h-4 w-4 mr-2" />
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{noEmailTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  const mailto = `mailto:${encodeURIComponent(trimmed)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      asChild
      {...buttonProps}
    >
      <a href={mailto}>
        <Mail className="h-4 w-4 mr-2" />
        {label}
      </a>
    </Button>
  );
}

export function deriveEmailSubject(action: string): string {
  const trimmed = action.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77).trimEnd() + "...";
}
