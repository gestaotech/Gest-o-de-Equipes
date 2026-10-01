import { api } from "./client";

export interface AsaasCustomerData {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
}

export interface AsaasCustomerResult {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  createdAt: string;
}

export async function createCustomer(data: AsaasCustomerData): Promise<AsaasCustomerResult> {
  const result = await api("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}

export async function getCustomer(id: string): Promise<AsaasCustomerResult> {
  const result = await api(`/customers/${id}`);
  return result;
}

export async function listCustomers(
  query?: string
): Promise<{ data: AsaasCustomerResult[]; total: number }> {
  const result = await api("/customers", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    // query params would be added via URLSearchParams
  });
  return result;
}