// Cliente HTTP mínimo com cookie de sessão, para os scripts de teste/demonstração.
const crypto = require("crypto");

function cliente(base) {
  // Local (HTTP): simula o proxy HTTPS para o cookie Secure da sessão funcionar.
  const proxy = /^http:\/\/localhost/.test(base) ? { "X-Forwarded-Proto": "https" } : {};
  return async function call(method, path, { body, cookie, raw, headers: extra = {} } = {}) {
    const headers = { ...proxy, ...extra };
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual"
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let json = null;
    if (!raw) {
      try {
        json = JSON.parse(buf.toString("utf8"));
      } catch {}
    }
    return { res, status: res.status, json, buf };
  };
}

const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0];

async function login(call, email, password) {
  const r = await call("POST", "/api/auth/login", { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${r.json?.message || ""}`);
  return { cookie: cookieOf(r.res), user: r.json };
}

const senhaForte = () => "Demo-" + crypto.randomBytes(9).toString("base64url") + "-7a";

// CPF válido gerado (fictício).
function cpfFicticio() {
  const n = Array.from({ length: 9 }, () => crypto.randomInt(0, 10));
  if (new Set(n).size === 1) n[0] = (n[0] + 1) % 10;
  const dv = (arr) => {
    const len = arr.length + 1;
    const s = arr.reduce((acc, d, i) => acc + d * (len - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  const s = n.join("");
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

// NPU válido (CNJ) gerado.
function npuFicticio(ano = 2015, origem = "0001") {
  const seq = String(crypto.randomInt(1, 9999999)).padStart(7, "0");
  const resto = `${ano}817${origem}`;
  const dv = 98 - Number(BigInt(seq + resto + "00") % 97n);
  return `${seq}-${String(dv).padStart(2, "0")}.${ano}.8.17.${origem}`;
}

module.exports = { cliente, cookieOf, login, senhaForte, cpfFicticio, npuFicticio };
