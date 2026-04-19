import { useCallback, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Copy, Check, ExternalLink } from "lucide-react";

interface SendEmailButtonProps extends Omit<ButtonProps, "onClick"> {
  email: string | null | undefined;
  subject: string;
  body: string;
  label?: string;
  noEmailTooltip?: string;
}

const MAILTO_SAFE_LIMIT = 1800;

function buildMailto(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  const [open, setOpen] = useState(false);
  const blurredRef = useRef(false);

  const tryOpenMail = useCallback(() => {
    if (!trimmed) return;
    const mailto = buildMailto(trimmed, subject, body);

    if (mailto.length > MAILTO_SAFE_LIMIT) {
      setOpen(true);
      return;
    }

    blurredRef.current = false;
    const onBlur = () => {
      blurredRef.current = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") blurredRef.current = true;
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    try {
      window.location.href = mailto;
    } catch {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      setOpen(true);
      return;
    }

    window.setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!blurredRef.current) {
        setOpen(true);
      }
    }, 800);
  }, [trimmed, subject, body]);

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

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <Button
          type="button"
          size={size}
          variant={variant}
          className={className}
          onClick={tryOpenMail}
          data-testid="button-send-email"
          {...buttonProps}
        >
          <Mail className="h-4 w-4 mr-2" />
          {label}
        </Button>
        <Button
          type="button"
          size={size}
          variant="ghost"
          onClick={() => setOpen(true)}
          aria-label="Show email contents"
          title="Show email contents"
          data-testid="button-show-email"
          className="px-2"
        >
          Show
        </Button>
      </span>

      <EmailFallbackDialog
        open={open}
        onOpenChange={setOpen}
        email={trimmed!}
        subject={subject}
        body={body}
        onTryAgain={tryOpenMail}
      />
    </>
  );
}

interface EmailFallbackDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  subject: string;
  body: string;
  onTryAgain: () => void;
}

function EmailFallbackDialog({
  open,
  onOpenChange,
  email,
  subject,
  body,
  onTryAgain,
}: EmailFallbackDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<"to" | "subject" | "body" | "all" | null>(null);

  const copy = async (value: string, key: "to" | "subject" | "body" | "all") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast({
        title: "Couldn't copy to clipboard",
        description: "Your browser blocked clipboard access. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send this email</DialogTitle>
          <DialogDescription>
            If your email app didn't open, copy the fields below into your mail client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FieldRow
            label="To"
            value={email}
            copied={copied === "to"}
            onCopy={() => copy(email, "to")}
            testId="email-field-to"
          />
          <FieldRow
            label="Subject"
            value={subject}
            copied={copied === "subject"}
            onCopy={() => copy(subject, "subject")}
            testId="email-field-subject"
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => copy(body, "body")}
                data-testid="button-copy-body"
              >
                {copied === "body" ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
            <textarea
              readOnly
              value={body}
              rows={8}
              className="w-full rounded border border-input bg-muted/30 p-2 text-sm font-mono"
              data-testid="email-field-body"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(`To: ${email}\nSubject: ${subject}\n\n${body}`, "all")}
            data-testid="button-copy-all"
          >
            {copied === "all" ? (
              <>
                <Check className="h-4 w-4 mr-2" /> Copied all
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" /> Copy all
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onTryAgain();
            }}
            data-testid="button-try-mail-again"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Try opening email app again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label,
  value,
  copied,
  onCopy,
  testId,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  testId: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <input
          readOnly
          value={value}
          className="flex-1 rounded border border-input bg-muted/30 px-2 py-1.5 text-sm"
          data-testid={testId}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function deriveEmailSubject(action: string): string {
  const trimmed = action.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77).trimEnd() + "...";
}
