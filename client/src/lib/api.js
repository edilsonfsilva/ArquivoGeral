import { apiRequest } from "./queryClient";

// Chamadas usadas pelo formulário público e pelo login. As telas internas usam lib/painel.js.
async function login(email, password) {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  return res.json();
}

async function createPublicRequest(data) {
  const res = await apiRequest("POST", "/api/requests", data);
  return res.json();
}

export { createPublicRequest, login };
