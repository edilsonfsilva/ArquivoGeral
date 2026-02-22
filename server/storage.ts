import { 
  users, requests, observations,
  type User, type InsertUser,
  type Request, type InsertRequest,
  type Observation, type InsertObservation
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;

  createRequest(req: InsertRequest): Promise<Request>;
  getRequest(id: number): Promise<Request | undefined>;
  getRequestByProtocol(protocolId: string): Promise<Request | undefined>;
  getAllRequests(): Promise<Request[]>;
  updateRequest(id: number, data: Partial<InsertRequest & { status: string }>): Promise<Request | undefined>;
  deleteRequest(id: number): Promise<void>;

  getObservationsByRequest(requestId: number): Promise<Observation[]>;
  createObservation(obs: InsertObservation): Promise<Observation>;

  getDashboardStats(): Promise<{
    today: number;
    week: number;
    byMonth: { month: string; count: number }[];
    byHour: { hour: string; count: number }[];
    topRequesters: { name: string; count: number }[];
    topAttendants: { name: string; count: number }[];
    byStatus: { status: string; count: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createRequest(req: InsertRequest): Promise<Request> {
    const protocolId = `AG-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const [created] = await db.insert(requests).values({ ...req, protocolId }).returning();
    return created;
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  }

  async getRequestByProtocol(protocolId: string): Promise<Request | undefined> {
    const [req] = await db.select().from(requests).where(eq(requests.protocolId, protocolId));
    return req;
  }

  async getAllRequests(): Promise<Request[]> {
    return db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async updateRequest(id: number, data: Partial<InsertRequest & { status: string }>): Promise<Request | undefined> {
    const [updated] = await db.update(requests).set(data).where(eq(requests.id, id)).returning();
    return updated;
  }

  async deleteRequest(id: number): Promise<void> {
    await db.delete(observations).where(eq(observations.requestId, id));
    await db.delete(requests).where(eq(requests.id, id));
  }

  async getObservationsByRequest(requestId: number): Promise<Observation[]> {
    return db.select().from(observations).where(eq(observations.requestId, requestId)).orderBy(desc(observations.createdAt));
  }

  async createObservation(obs: InsertObservation): Promise<Observation> {
    const [created] = await db.insert(observations).values(obs).returning();
    return created;
  }

  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const allReqs = await db.select().from(requests);

    const today = allReqs.filter(r => r.createdAt >= startOfDay).length;
    const week = allReqs.filter(r => r.createdAt >= startOfWeek).length;

    const monthMap: Record<string, number> = {};
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    allReqs.forEach(r => {
      const key = months[r.createdAt.getMonth()];
      monthMap[key] = (monthMap[key] || 0) + 1;
    });
    const byMonth = months.map(m => ({ month: m, count: monthMap[m] || 0 }));

    const hourMap: Record<string, number> = {};
    allReqs.forEach(r => {
      const h = `${String(r.createdAt.getHours()).padStart(2, '0')}h`;
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const byHour = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"]
      .map(h => ({ hour: h, count: hourMap[h] || 0 }));

    const requesterMap: Record<string, number> = {};
    allReqs.forEach(r => {
      requesterMap[r.nomeCompleto] = (requesterMap[r.nomeCompleto] || 0) + 1;
    });
    const topRequesters = Object.entries(requesterMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const allObs = await db.select().from(observations);
    const attendantMap: Record<string, number> = {};
    allObs.forEach(o => {
      attendantMap[o.authorName] = (attendantMap[o.authorName] || 0) + 1;
    });
    const topAttendants = Object.entries(attendantMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const statusMap: Record<string, number> = {};
    allReqs.forEach(r => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    });
    const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    return { today, week, byMonth, byHour, topRequesters, topAttendants, byStatus };
  }
}

export const storage = new DatabaseStorage();
