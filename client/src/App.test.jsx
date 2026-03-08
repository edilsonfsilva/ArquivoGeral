import { describe, it, expect, beforeEach } from "vitest";
import { checkAuth } from "./pages/Login";
describe("Auth functions", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("checkAuth should return false when not authenticated", () => {
    expect(checkAuth()).toBe(false);
  });
  it("checkAuth should return true when authenticated", () => {
    localStorage.setItem("adminAuth", "true");
    expect(checkAuth()).toBe(true);
  });
});
