import { spawn } from "node:child_process";
import http from "node:http";

const PORT = 3045;
const BASE_URL = `http://localhost:${PORT}`;

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}${path}`, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("==================================================================");
  console.log("CRADLEHUB CRM CASHIER — PRODUCTION RUNTIME SERVER VERIFICATION");
  console.log("Testing Next.js production server for Server Components runtime errors");
  console.log("------------------------------------------------------------------");

  let serverStderr = "";
  let serverStdout = "";

  console.log(`[1/3] Launching 'next start -p ${PORT}' in production mode...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => {
    serverStdout += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverStderr += chunk.toString();
  });

  // Wait for server ready
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (serverStdout.includes("Ready in") || serverStdout.includes("started server on")) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    console.error("FAIL: Server failed to start within 15 seconds.");
    console.error("Stdout:", serverStdout);
    console.error("Stderr:", serverStderr);
    server.kill();
    process.exit(1);
  }
  console.log("  ✔ Next.js production server is ready and listening.");

  try {
    console.log("[2/3] Probing /crm/cash-flow and /crm/today in production mode...");

    const cashFlowRes = await get("/crm/cash-flow");
    console.log(`  ✔ /crm/cash-flow HTTP Status: ${cashFlowRes.status}`);

    const todayRes = await get("/crm/today");
    console.log(`  ✔ /crm/today HTTP Status: ${todayRes.status}`);

    console.log("[3/3] Inspecting server runtime logs for Server Components errors...");

    const forbiddenPattern = /A "use server" file can only export async functions, found object/i;
    if (forbiddenPattern.test(serverStderr) || forbiddenPattern.test(serverStdout)) {
      console.error("FAIL: Found 'use server' export object error in server logs!");
      console.error(serverStderr);
      process.exit(1);
    }

    if (serverStderr.includes("Error:") || serverStderr.includes("TypeError:")) {
      console.error("FAIL: Unhandled error found in production server stderr!");
      console.error(serverStderr);
      process.exit(1);
    }

    console.log("  ✔ Zero 'use server' export errors detected.");
    console.log("  ✔ Zero unhandled Server Components exceptions.");
    console.log("==================================================================");
    console.log("PRODUCTION RUNTIME VERIFICATION PASSED CLEANLY!");
    console.log("==================================================================");
  } finally {
    if (server.pid) {
      try {
        process.kill(server.pid, "SIGKILL");
      } catch {}
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
