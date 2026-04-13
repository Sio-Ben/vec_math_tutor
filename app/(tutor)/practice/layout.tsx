export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#0f1014] px-4 py-6 text-zinc-100 shadow-inner sm:px-6 sm:py-8">
      {children}
    </div>
  );
}
