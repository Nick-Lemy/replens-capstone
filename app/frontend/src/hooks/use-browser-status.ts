import { useEffect, useState } from "react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function useBrowserStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const connect = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener("online", connect);
    window.addEventListener("offline", connect);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", connect);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  return { online, install, dismissInstall: () => setInstall(null) };
}
