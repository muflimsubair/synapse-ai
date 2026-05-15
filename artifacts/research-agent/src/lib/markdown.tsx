import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

export function Markdown({ content, className = "", streaming = false }: MarkdownProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className} ${streaming ? "streaming-cursor" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="!rounded-lg !text-xs !my-3"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
                {...props}
              >
                {children}
              </a>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-2 border-primary pl-4 italic text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
