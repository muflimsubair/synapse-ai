import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Send, Globe, MessageSquare, ChevronLeft, ChevronRight, Bot, User, Loader2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  useGetOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface StreamMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: conversations, isLoading: convsLoading } = useListOpenaiConversations();
  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();
  const { data: conversation, isLoading: convLoading } = useGetOpenaiConversation(
    selectedId!,
    { query: { enabled: !!selectedId, queryKey: getGetOpenaiConversationQueryKey(selectedId!) } }
  );

  // Sync stream messages with loaded conversation
  useEffect(() => {
    if (conversation?.messages) {
      setStreamMessages(
        conversation.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    } else {
      setStreamMessages([]);
    }
  }, [conversation?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamMessages]);

  const handleNewChat = async () => {
    const conv = await createConv.mutateAsync({ data: { title: "New conversation" } });
    qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    setSelectedId(conv.id);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConv.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    if (selectedId === id) setSelectedId(null);
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return;
    let convId = selectedId;

    // Auto-create conversation if none selected
    if (!convId) {
      const title = input.slice(0, 60) || "New conversation";
      const conv = await createConv.mutateAsync({ data: { title } });
      qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      convId = conv.id;
      setSelectedId(conv.id);
    }

    const userMsg = input.trim();
    setInput("");
    setStreamMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreamMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`/api/openai/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg, useWebSearch }),
        signal: ctrl.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.content) {
                setStreamMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    return [...updated.slice(0, -1), { ...last, content: last.content + parsed.content }];
                  }
                  return updated;
                });
              }
              if (parsed.done) {
                setStreamMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    return [...updated.slice(0, -1), { ...last, streaming: false }];
                  }
                  return updated;
                });
                qc.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId!) });
                qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStreamMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            return [...updated.slice(0, -1), { ...last, content: "Sorry, something went wrong.", streaming: false }];
          }
          return updated;
        });
      }
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, selectedId, useWebSearch, createConv, qc]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="flex-shrink-0 flex flex-col border-r border-border bg-sidebar overflow-hidden"
          >
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversations</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleNewChat}
                data-testid="button-new-chat"
              >
                <Plus size={14} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {convsLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)
              ) : !conversations?.length ? (
                <div className="py-8 text-center">
                  <MessageSquare size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                      selectedId === conv.id
                        ? "bg-primary/15 text-primary"
                        : "hover:bg-muted/60 text-foreground/80"
                    )}
                    onClick={() => setSelectedId(conv.id)}
                    data-testid={`conv-item-${conv.id}`}
                  >
                    <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-conv-${conv.id}`}
                    >
                      <Trash2 size={12} className="text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-chat-sidebar-toggle"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {conversation?.title ?? (selectedId ? "Loading..." : "New conversation")}
            </p>
          </div>
          <button
            onClick={() => setUseWebSearch((w) => !w)}
            data-testid="button-web-search-toggle"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
              useWebSearch
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-border hover:border-primary/30"
            )}
          >
            <Globe size={12} />
            Web
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {!selectedId && !streamMessages.length ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bot size={26} className="text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Start a research conversation</h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Ask anything. Toggle web search for live results. The AI will remember your conversation history.
              </p>
            </div>
          ) : convLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "flex-row-reverse" : "")}>
                  <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                  <Skeleton className={cn("h-16 rounded-2xl", i % 2 === 0 ? "w-64" : "w-80")} />
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {streamMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn("flex gap-3 max-w-4xl mx-auto w-full", msg.role === "user" ? "flex-row-reverse" : "")}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    msg.role === "user" ? "bg-primary/20" : "bg-muted"
                  )}>
                    {msg.role === "user" ? <User size={14} className="text-primary" /> : <Bot size={14} className="text-muted-foreground" />}
                  </div>
                  <div className={cn(
                    "max-w-[80%] px-4 py-3 rounded-2xl",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}>
                    {msg.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.content ? (
                      <Markdown content={msg.content} streaming={msg.streaming} className="text-sm" />
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-xs">Thinking...</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border">
          <div className="max-w-4xl mx-auto relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Shift+Enter for new line)"
              rows={2}
              className="pr-12 resize-none rounded-xl text-sm bg-muted/40 border-border focus:border-primary/50"
              disabled={streaming}
              data-testid="input-chat"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="absolute right-2.5 bottom-2.5 h-7 w-7"
              data-testid="button-send-message"
            >
              {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </div>
          {useWebSearch && (
            <p className="text-center text-[10px] text-primary/70 mt-2">
              Web search enabled — responses will include live search results via Tavily
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
