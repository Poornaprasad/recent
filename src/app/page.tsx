"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceProcessorPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to invoices page since documents come from API
    router.replace('/invoices');
  }, [router]);

  return null;
}
