"use client";

import * as React from "react";
import { Sparkles, Send, Loader2, Bot, User, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentCoachContext } from "@/components/agent/agent-context-provider";
import { getCrmProactiveGreeting } from "@/lib/agents/crm/prompts";
import type { AgentMessage, AgentSuggestedAction } from "@/lib/agents/types";

function useCoachChat() {
  const { context } = useAgentCoachContext();
  const [open, setOpen] = React.useState(false);
  const [history, setHistory] = React.useState<AgentMessage[]>(() => [
    {
      role: "assistant",
      content: getCrmProactiveGreeting(context),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | undefined>();

  const callCoach = React.useCallback(
    async (message: string) => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/agent/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            context: { ...context, sessionId },
            history,
          }),
        });

        const data = await res.json().catch(() => ({
          reply: {
            role: "assistant" as const,
            content: "Sorry, I didn't catch that. Please try again.",
          },
        }));

        const assistantMsg: AgentMessage = data.reply ?? {
          role: "assistant",
          content: "Sorry, something went wrong.",
        };

        setHistory((prev) => [
          ...prev,
          { role: "user", content: message },
          assistantMsg,
        ]);
        if (data.sessionId) setSessionId(data.sessionId);
      } finally {
        setIsLoading(false);
      }
    },
    [context, history, sessionId]
  );

  const sendMessage = React.useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    callCoach(trimmed);
  }, [input, isLoading, callCoach]);

  return { open, setOpen, history, input, setInput, isLoading, sendMessage };
}

function SuggestedActions({ actions }: { actions: AgentSuggestedAction[] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((action) =>
        action.href ? (
          <Button
            key={action.id}
            variant="outline"
            size="xs"
            asChild
            className="h-auto rounded-full px-2 py-0.5 text-[10px]"
          >
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button
            key={action.id}
            variant="outline"
            size="xs"
            className="h-auto rounded-full px-2 py-0.5 text-[10px]"
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}

export function CoachBubble() {
  const { open, setOpen, history, input, setInput, isLoading, sendMessage } = useCoachChat();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8">
      {open && (
        <div
          className={cn(
            "flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-popover shadow-xl",
            "animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-200"
          )}
          role="dialog"
          aria-label="Cradle Coach chat"
          style={{ maxHeight: "min(70vh, 32rem)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-primary px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground">
                <Bot className="size-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-foreground">Cradle Coach</p>
                <p className="text-[10px] text-primary-foreground/80">Ask me how to use the CRM</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setOpen(false)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              {history.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      msg.role === "user" ? "bg-muted" : "bg-primary/10 text-primary"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="size-3" />
                    ) : (
                      <Bot className="size-3" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted rounded-bl-none"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && msg.actions && (
                      <SuggestedActions actions={msg.actions} />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-3" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-none bg-muted px-3 py-2 text-xs">
                    <Loader2 className="size-3 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t p-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask something..."
                className="min-h-[40px] resize-none rounded-xl text-xs"
                rows={1}
              />
              <Button
                size="icon-sm"
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "h-12 w-12 rounded-full shadow-lg transition-transform",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          open && "rotate-0"
        )}
        size="icon-lg"
        aria-label={open ? "Close Cradle Coach" : "Open Cradle Coach"}
      >
        <Sparkles className="size-5" />
      </Button>
    </div>
  );
}
