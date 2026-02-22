import { apiRequest } from "./queryClient";

export async function login(email: string, password: string) {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  return res.json();
}

export async function logout() {
  await apiRequest("POST", "/api/auth/logout");
}

export async function getMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Não autenticado");
  return res.json();
}

export async function getRequests() {
  const res = await fetch("/api/requests", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar solicitações");
  return res.json();
}

export async function createPublicRequest(data: any) {
  const res = await apiRequest("POST", "/api/requests", data);
  return res.json();
}

export async function updateRequest(id: number, data: any) {
  const res = await apiRequest("PATCH", `/api/requests/${id}`, data);
  return res.json();
}

export async function deleteRequest(id: number) {
  await apiRequest("DELETE", `/api/requests/${id}`);
}

export async function getObservations(requestId: number) {
  const res = await fetch(`/api/requests/${requestId}/observations`, { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar observações");
  return res.json();
}

export async function addObservation(requestId: number, text: string) {
  const res = await apiRequest("POST", `/api/requests/${requestId}/observations`, { text });
  return res.json();
}

export async function getUsers() {
  const res = await fetch("/api/users", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar usuários");
  return res.json();
}

export async function createUser(data: any) {
  const res = await apiRequest("POST", "/api/users", data);
  return res.json();
}

export async function updateUser(id: number, data: any) {
  const res = await apiRequest("PATCH", `/api/users/${id}`, data);
  return res.json();
}

export async function deleteUser(id: number) {
  await apiRequest("DELETE", `/api/users/${id}`);
}

export async function getDashboard() {
  const res = await fetch("/api/dashboard", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar dashboard");
  return res.json();
}
