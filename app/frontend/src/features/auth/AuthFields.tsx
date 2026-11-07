import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AuthField({ label, hint, id, type, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={password && visible ? "text" : type}
          className={`min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-ink ${password ? "pr-12" : ""}`}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-ink"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
