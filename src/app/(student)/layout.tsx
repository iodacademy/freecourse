import Header from "@/components/Header";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="page-content">{children}</main>
    </>
  );
}
