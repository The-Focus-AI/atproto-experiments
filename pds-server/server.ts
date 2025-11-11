import "dotenv/config";

import { envStr } from "@atproto/common";
import { PDS, envToCfg, envToSecrets, readEnv } from "@atproto/pds";
import pkg from "@atproto/pds/package.json" with { type: "json" };

import process from "node:process";

const main = async () => {
  const env = readEnv();
  env.version ||= pkg.version;
  const cfg = envToCfg(env);
  const secrets = envToSecrets(env);
  const pds = await PDS.create(cfg, secrets);

  // hack: allow listening on non-0.0.0.0 addresses
  const host = envStr("BIND_HOST") ?? "127.0.0.1";
  const appListen = pds.app.listen;
  pds.app.listen = (port) => {
    return appListen(port, host);
  };

  await pds.start();
  process.on("SIGTERM", async () => {
    await pds.destroy();
  });
};

main();
