import { Camera, Check } from "lucide-react";

export function FilmingTips() {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <Camera size={16} />A clearer view helps
      </div>
      <div className="grid gap-3 text-sm text-muted">
        {[
          "Keep shoulders, elbows and wrists in the frame.",
          "Use a steady camera with light facing you.",
          "Include the beginning and end of a single set.",
          "Use a clear video captured at 30 frames per second or higher.",
        ].map((text) => (
          <div key={text} className="flex items-start gap-2.5">
            <Check size={14} className="mt-0.5 shrink-0" />
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
