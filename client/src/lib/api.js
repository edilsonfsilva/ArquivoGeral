import { apiRequest } from "./queryClient";
async function login(email, password) {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  return res.json();
}
async function logout() {
  await apiRequest("POST", "/api/auth/logout");
}
async function getMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("N\xE3o autenticado");
  return res.json();
}
async function getRequests() {
  const res = await fetch("/api/requests", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar solicita\xE7\xF5es");
  return res.json();
}
async function createPublicRequest(data) {
  const res = await apiRequest("POST", "/api/requests", data);
  return res.json();
}
async function updateRequest(id, data) {
  const res = await apiRequest("PATCH", `/api/requests/${id}`, data);
  return res.json();
}
async function deleteRequest(id) {
  await apiRequest("DELETE", `/api/requests/${id}`);
}
async function getObservations(requestId) {
  const res = await fetch(`/api/requests/${requestId}/observations`, { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar observa\xE7\xF5es");
  return res.json();
}
async function addObservation(requestId, text) {
  const res = await apiRequest("POST", `/api/requests/${requestId}/observations`, { text });
  return res.json();
}
async function getUsers() {
  const res = await fetch("/api/users", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar usu\xE1rios");
  return res.json();
}
async function createUser(data) {
  const res = await apiRequest("POST", "/api/users", data);
  return res.json();
}
async function updateUser(id, data) {
  const res = await apiRequest("PATCH", `/api/users/${id}`, data);
  return res.json();
}
async function deleteUser(id) {
  await apiRequest("DELETE", `/api/users/${id}`);
}
async function getDashboard() {
  const res = await fetch("/api/dashboard", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar dashboard");
  return res.json();
}
export {
  addObservation,
  createPublicRequest,
  createUser,
  deleteRequest,
  deleteUser,
  getDashboard,
  getMe,
  getObservations,
  getRequests,
  getUsers,
  login,
  logout,
  updateRequest,
  updateUser
};
