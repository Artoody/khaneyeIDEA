/* eslint-disable @next/next/no-img-element -- legacy article images of unknown size (moved locally by db legacy-media); next/image needs known dimensions */
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Article / course text from Markdown. Raw HTML is not rendered (safe by default). The page already has its own
 * H1, so headings inside the text start at H2. Images load lazily and keep their aspect ratio.
 */
export function Prose({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: c }) => <h2>{c}</h2>,
          img: ({ src, alt }) => (typeof src === "string" ? <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" /> : null),
          a: ({ href, children: c }) => {
            const external = !!href && /^https?:\/\//.test(href) && !href.includes("khaneyeide.ir");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {c}
              </a>
            );
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
