import React from "react";
import { AdminAuthProvider } from "@/features/admin/AdminAuthContext";
import { AdminGuard } from "@/features/admin/components/AdminGuard";
import { AdminNavbar } from "@/features/admin/components/AdminNavbar";

export const metadata = {
  title: "Sahayak Admin Dashboard",
  description: "Catalogue management and scheme verification portal",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <AdminNavbar />
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          <AdminGuard>{children}</AdminGuard>
        </main>
      </div>
    </AdminAuthProvider>
  );
}
