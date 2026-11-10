import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const name = `coride-check-${Date.now()}`;
const env = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
const base = ["--host=unix:///var/run/docker.sock"];
function docker(args, input) {
  const r = spawnSync("docker", [...base, ...args], {
    input,
    encoding: "utf8",
    env,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout;
}
function sql(text) {
  return docker(
    [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
    ],
    text,
  );
}
function concurrent(text) {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      [
        ...base,
        "exec",
        "-i",
        name,
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-qAt",
      ],
      { env },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => resolve({ code, output }));
    child.stdin.end(text);
  });
}
try {
  docker([
    "run",
    "-d",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD=local-test-only",
    "postgres:17-alpine",
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = spawnSync(
      "docker",
      [...base, "exec", name, "pg_isready", "-U", "postgres"],
      { env },
    );
    if (result.status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error("PostgreSQL did not become ready.");
  sql(readFileSync("tests/database-bootstrap.sql", "utf8"));
  sql(readFileSync("supabase/schema.sql", "utf8"));
  sql(readFileSync("tests/database.sql", "utf8"));
  console.log(
    "PASS: approval, role escalation, review eligibility, chat and location permissions",
  );
  sql(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
 insert into rides(id,driver_id,from_city,to_city,pickup,dropoff,departure,duration,price,seats) values('20000000-0000-0000-0000-000000000002',auth.uid(),'Larnaca','Nicosia','{}','{}',now()+interval '2 days',45,6,1);
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);select request_booking('20000000-0000-0000-0000-000000000002');
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);select request_booking('20000000-0000-0000-0000-000000000002');`);
  const accept = (passenger) =>
    `begin;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);select respond_booking((select id from bookings where ride_id='20000000-0000-0000-0000-000000000002' and passenger_id='00000000-0000-0000-0000-00000000000${passenger}'),'accepted');select pg_sleep(0.2);commit;`;
  const result = await Promise.all([
    concurrent(accept(2)),
    concurrent(accept(3)),
  ]);
  assert.equal(result.filter((r) => r.code === 0).length, 1);
  assert.ok(
    result.find((r) => r.code !== 0)?.output.includes("Ride unavailable"),
  );
  assert.equal(
    sql(
      "select count(*) from bookings where ride_id='20000000-0000-0000-0000-000000000002' and status='accepted';",
    ).trim(),
    "1",
  );
  assert.equal(
    sql(
      "select seats from rides where id='20000000-0000-0000-0000-000000000002';",
    ).trim(),
    "0",
  );
  console.log(
    "PASS: simultaneous driver approvals cannot oversell the last seat",
  );

  const passenger = sql(
    "select passenger_id from bookings where ride_id='20000000-0000-0000-0000-000000000002' and status='accepted';",
  ).trim();
  sql(
    `set role authenticated;select set_config('request.jwt.claim.sub','${passenger}',false);select cancel_booking((select id from bookings where ride_id='20000000-0000-0000-0000-000000000002' and passenger_id=auth.uid()));`,
  );
  assert.equal(
    sql(
      "select seats from rides where id='20000000-0000-0000-0000-000000000002';",
    ).trim(),
    "1",
  );
  console.log("PASS: cancellation returns exactly one accepted seat");
  const rate = sql(
    "set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);select consume_address_search() from generate_series(1,31);",
  )
    .trim()
    .split("\n")
    .slice(1);
  assert.equal(rate.filter((v) => v === "t").length, 30);
  assert.equal(rate.at(-1), "f");
  console.log("PASS: Google address search is rate limited per user");
  console.log("Database checks passed.");
} finally {
  spawnSync("docker", [...base, "rm", "-f", name], { env, stdio: "ignore" });
}
