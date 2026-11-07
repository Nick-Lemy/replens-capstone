import { Check } from "lucide-react";

export function FilmingTips() {
  return (
    <div className="grid gap-3 text-sm text-muted">
      {[
        "Keep shoulders, elbows and wrists in the frame.",
        "Use a steady camera with light facing you.",
        "Include the beginning and end of a single set.",
        "Use a clear video captured at 30 frames per second or higher.",
      ].map((text) => (
        <div key={text} className="flex items-start gap-2.5">
          <Check size={14} className="mt-0.5 shrink-0 text-accent" />
          <p>{text}</p>
        </div>
      ))}
    </div>
  );
}
