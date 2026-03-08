import {
  users,
  requests,
  observations
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc } from "drizzle-orm";
class DatabaseStorage {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async createUser(user) {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }
  async updateUser(id, data) {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }
  async deleteUser(id) {
    await db.delete(users).where(eq(users.id, id));
  }
  async getAllUsers() {
    return db.select().from(users);
  }
  async createRequest(req) {
    const protocolId = `AG-${String(Math.floor(1e5 + Math.random() * 9e5))}`;
    const [created] = await db.insert(requests).values({ ...req, protocolId }).returning();
    return created;
  }
  async getRequest(id) {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  }
  async getRequestByProtocol(protocolId) {
    const [req] = await db.select().from(requests).where(eq(requests.protocolId, protocolId));
    return req;
  }
  async getAllRequests() {
    return db.select().from(requests).orderBy(desc(requests.createdAt));
  }
  async updateRequest(id, data) {
    const [updated] = await db.update(requests).set(data).where(eq(requests.id, id)).returning();
    return updated;
  }
  async deleteRequest(id) {
    await db.delete(observations).where(eq(observations.requestId, id));
    await db.delete(requests).where(eq(requests.id, id));
  }
  async getObservationsByRequest(requestId) {
    return db.select().from(observations).where(eq(observations.requestId, requestId)).orderBy(desc(observations.createdAt));
  }
  async createObservation(obs) {
    const [created] = await db.insert(observations).values(obs).returning();
    return created;
  }
  async getDashboardStats() {
    const now = /* @__PURE__ */ new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const allReqs = await db.select().from(requests);
    const today = allReqs.filter((r) => r.createdAt >= startOfDay).length;
    const week = allReqs.filter((r) => r.createdAt >= startOfWeek).length;
    const monthMap = {};
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    allReqs.forEach((r) => {
      const key = months[r.createdAt.getMonth()];
      monthMap[key] = (monthMap[key] || 0) + 1;
    });
    const byMonth = months.map((m) => ({ month: m, count: monthMap[m] || 0 }));
    const hourMap = {};
    allReqs.forEach((r) => {
      const h = `${String(r.createdAt.getHours()).padStart(2, "0")}h`;
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const byHour = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"].map((h) => ({ hour: h, count: hourMap[h] || 0 }));
    const requesterMap = {};
    allReqs.forEach((r) => {
      requesterMap[r.nomeCompleto] = (requesterMap[r.nomeCompleto] || 0) + 1;
    });
    const topRequesters = Object.entries(requesterMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
    const allObs = await db.select().from(observations);
    const attendantMap = {};
    allObs.forEach((o) => {
      attendantMap[o.authorName] = (attendantMap[o.authorName] || 0) + 1;
    });
    const topAttendants = Object.entries(attendantMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
    const statusMap = {};
    allReqs.forEach((r) => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    });
    const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
    return { today, week, byMonth, byHour, topRequesters, topAttendants, byStatus };
  }
}
const storage = new DatabaseStorage();
export {
  DatabaseStorage,
  storage
};
