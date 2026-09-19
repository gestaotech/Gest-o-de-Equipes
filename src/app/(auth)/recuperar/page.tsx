import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return <ForgotForm />;
}