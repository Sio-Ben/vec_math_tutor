import { MainNav } from "@/components/MainNav";
import { MathLiveKeyboardCloser } from "@/components/MathLiveKeyboardCloser";

export default function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f6f4ef] dark:bg-zinc-950">
      <MainNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</div>
      <MathLiveKeyboardCloser />
    </div>
  );
}
