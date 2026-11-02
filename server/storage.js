import { randomInt } from "crypto";
import { users, requests, observations } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, count } from "drizzle-orm";

// Colunas devolvidas ao painel: tudo, exceto o conteúdo binário do anexo.
const requestColumns = {
  id: requests.id,
  protocolId: requests.protocolId,
  status: requests.status,
  nomeCompleto: requests.nomeCompleto,
  cpf: requests.cpf,
  whatsapp: requests.whatsapp,
  email: requests.email,
  oab: requests.oab,
  tipoNumeracao: requests.tipoNumeracao,
  numeroProcesso: requests.numeroProcesso,
  partes: requests.partes,
  comarca: requests.comarca,
  varaUnidade: requests.varaUnidade,
  segredoJustica: requests.segredoJustica,
  observacao: requests.observacao,
  anexoName: requests.anexoName,
  anexoSize: requests.anexoSize,
  anexoType: requests.anexoType,
  createdAt: requests.createdAt
};

class DatabaseStorage {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, String(email).toLowerCase()));
    return user;
  }
  async createUser(user) {
    const [created] = await db
      .insert(users)
      .values({ ...user, email: String(user.email).toLowerCase() })
      .returning();
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
  async countAdmins() {
    const [row] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    return Number(row?.n || 0);
  }
  async createRequest(req) {
    // Protocolo com gerador criptográfico; tenta de novo em caso de colisão.
    for (let attempt = 0; attempt < 5; attempt++) {
      const protocolId = `AG-${randomInt(100000, 1000000)}`;
      try {
        const [created] = await db
          .insert(requests)
          .values({ ...req, protocolId })
          .returning({ id: requests.id, protocolId: requests.protocolId, createdAt: requests.createdAt });
        return created;
      } catch (err) {
        if (err?.code === "23505" && String(err?.constraint || "").includes("protocol")) continue;
        throw err;
      }
    }
    throw new Error("Não foi possível gerar um protocolo único");
  }
  async getRequest(id) {
    const [req] = await db.select(requestColumns).from(requests).where(eq(requests.id, id));
    return req;
  }
  async getRequestAnexo(id) {
    const [row] = await db
      .select({ name: requests.anexoName, type: requests.anexoType, data: requests.anexoData })
      .from(requests)
      .where(eq(requests.id, id));
    return row;
  }
  async getAllRequests() {
    return db.select(requestColumns).from(requests).orderBy(desc(requests.createdAt));
  }
  async updateRequest(id, data) {
    const [updated] = await db.update(requests).set(data).where(eq(requests.id, id)).returning(requestColumns);
    return updated;
  }
  async deleteRequest(id) {
    await db.delete(observations).where(eq(observations.requestId, id));
    await db.delete(requests).where(eq(requests.id, id));
  }
  async getObservationsByRequest(requestId) {
    return db
      .select()
      .from(observations)
      .where(eq(observations.requestId, requestId))
      .orderBy(desc(observations.createdAt));
  }
  async createObservation(obs) {
    const [created] = await db.insert(observations).values(obs).returning();
    return created;
  }
  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const allReqs = await db
      .select({ createdAt: requests.createdAt, status: requests.status, nomeCompleto: requests.nomeCompleto })
      .from(requests);
    const today = allReqs.filter((r) => r.createdAt >= startOfDay).length;
    const week = allReqs.filter((r) => r.createdAt >= startOfWeek).length;
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    // Só o ano corrente, para não somar meses de anos diferentes.
    const monthMap = {};
    allReqs
      .filter((r) => r.createdAt.getFullYear() === now.getFullYear())
      .forEach((r) => {
        const key = months[r.createdAt.getMonth()];
        monthMap[key] = (monthMap[key] || 0) + 1;
      });
    const byMonth = months.map((m) => ({ month: m, count: monthMap[m] || 0 }));
    const hourMap = {};
    allReqs.forEach((r) => {
      const h = `${String(r.createdAt.getHours()).padStart(2, "0")}h`;
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const byHour = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"].map((h) => ({
      hour: h,
      count: hourMap[h] || 0
    }));
    const requesterMap = {};
    allReqs.forEach((r) => {
      requesterMap[r.nomeCompleto] = (requesterMap[r.nomeCompleto] || 0) + 1;
    });
    const topRequesters = Object.entries(requesterMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count2]) => ({ name, count: count2 }));
    const allObs = await db.select({ authorName: observations.authorName }).from(observations);
    const attendantMap = {};
    allObs.forEach((o) => {
      attendantMap[o.authorName] = (attendantMap[o.authorName] || 0) + 1;
    });
    const topAttendants = Object.entries(attendantMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count2]) => ({ name, count: count2 }));
    const statusMap = {};
    allReqs.forEach((r) => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    });
    const byStatus = Object.entries(statusMap).map(([status, count2]) => ({ status, count: count2 }));
    return { today, week, byMonth, byHour, topRequesters, topAttendants, byStatus };
  }
}
const storage = new DatabaseStorage();
export { DatabaseStorage, storage };
