import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => (
          <h1 className="text-[20px] font-black text-white mt-2 mb-2" {...props} />
        ),
        h2: (props) => (
          <h2 className="text-[18px] font-extrabold text-white mt-3 mb-2" {...props} />
        ),
        h3: (props) => (
          <h3 className="text-[16px] font-bold text-white mt-3 mb-2" {...props} />
        ),
        p: (props) => (
          <p className="text-[15px] leading-[28px] text-slate-200 mb-2" {...props} />
        ),
        strong: (props) => <strong className="font-extrabold text-white" {...props} />,
        ul: (props) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
        ol: (props) => <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />,
        li: (props) => <li className="text-[15px] leading-[26px] text-slate-200" {...props} />,
        blockquote: (props) => (
          <blockquote
            className="border-l-4 border-slate-700 pl-4 my-2 text-slate-300 italic"
            {...props}
          />
        ),
        code: ({ inline, children, ...props }) => {
          if (inline) {
            return (
              <code
                className="px-1 py-0.5 rounded bg-slate-800/60 border border-slate-700 text-slate-100 text-[13px]"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <pre className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 overflow-auto my-2">
              <code className="text-[13px] leading-[20px] text-slate-100">{children}</code>
            </pre>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
