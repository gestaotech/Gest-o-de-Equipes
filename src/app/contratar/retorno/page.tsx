import { redirect } from "next/navigation";

// O retorno de checkout deixa de ser acessível enquanto Asaas estiver desativado.
export default function CheckoutReturnPage() {
  redirect("/");
}
