import { redirect } from "next/navigation";

// Contratação online/Asaas está temporariamente desativada.
// O fluxo atual de contratação é feito com a equipe comercial via WhatsApp.
export default function CheckoutPage() {
  redirect("/#planos");
}
