import { useCallback, useEffect, useRef, useState } from "react";
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
import { Mail, Copy, Check, RotateCcw } from "lucide-react";

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
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);
  const blurredRef = useRef(false);

  // Reset the staff's draft only when the underlying AI-suggested values
  // actually change (e.g. a different donor or follow-up is selected).
  // This way, closing and reopening the dialog preserves in-progress edits.
  const lastSuggestionRef = useRef({ subject, body });
  useEffect(() => {
    const last = lastSuggestionRef.current;
    if (last.subject !== subject || last.body !== body) {
      lastSuggestionRef.current = { subject, body };
      setEditedSubject(subject);
      setEditedBody(body);
    }
  }, [subject, body]);

  const tryOpenMail = useCallback(
    (overrideSubject?: string, overrideBody?: string) => {
      if (!trimmed) return;
      const useSubject = overrideSubject ?? editedSubject;
      const useBody = overrideBody ?? editedBody;
      const mailto = buildMailto(trimmed, useSubject, useBody);

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
    },
    [trimmed, editedSubject, editedBody],
  );

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
          onClick={() => tryOpenMail(subject, body)}
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
        subject={editedSubject}
        body={editedBody}
        originalSubject={subject}
        originalBody={body}
        onSubjectChange={setEditedSubject}
        onBodyChange={setEditedBody}
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
  originalSubject: string;
  originalBody: string;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
}

function EmailFallbackDialog({
  open,
  onOpenChange,
  email,
  subject,
  body,
  originalSubject,
  originalBody,
  onSubjectChange,
  onBodyChange,
}: EmailFallbackDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<"to" | "subject" | "body" | "all" | null>(null);

  const isEdited = subject !== originalSubject || body !== originalBody;

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

  const handleReset = () => {
    onSubjectChange(originalSubject);
    onBodyChange(originalBody);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send this email</DialogTitle>
          <DialogDescription>
            Edit the subject or message below, then open your mail app or copy the fields into your mail client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                readOnly
                value={email}
                className="flex-1 rounded border border-input bg-muted/30 px-2 py-1.5 text-sm"
                data-testid="email-field-to"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => copy(email, "to")}>
                {copied === "to" ? (
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

          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm"
                data-testid="email-field-subject"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => copy(subject, "subject")}>
                {copied === "subject" ? (
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <div className="flex items-center gap-1">
                {isEdited && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleReset}
                    data-testid="button-reset-email"
                    title="Restore the original AI-suggested subject and message"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                  </Button>
                )}
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
            </div>
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={8}
              className="w-full rounded border border-input bg-background p-2 text-sm font-mono"
              data-testid="email-field-body"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function deriveEmailSubject(action: string): string {
  const trimmed = action.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77).trimEnd() + "...";
}
