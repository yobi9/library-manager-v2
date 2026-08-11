export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className=" admin-layout relative flex min-h-screen items-center justify-center overflow-hidden bg-background"
       data-theme="theme"
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-br from-primary/20 via-background to-accent/20" />
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
