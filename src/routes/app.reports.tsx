import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/reports")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "রিপোর্ট — Tally BD" }, { name: "description", content: "MIS ও ব্যবসায়িক রিপোর্ট" }] }),
});