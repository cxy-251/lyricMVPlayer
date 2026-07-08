import React from "react";
import {Check, Copy} from "lucide-react";
import {motion} from "framer-motion";

type CodeBlockProps = {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({label, value, onCopy}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    onCopy(value, label);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  }, [label, onCopy, value]);

  return (
    <motion.article
      className="gradient-atlas-code"
      initial={{opacity: 0, y: 8}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.22}}
    >
      <div className="gradient-atlas-code__head">
        <span>{label}</span>
        <button type="button" onClick={handleCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
    </motion.article>
  );
};
