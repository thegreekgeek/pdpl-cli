import { Args, Command, Flags, Interfaces } from "@oclif/core";

import logger from "../../utils/logger.js";
import getConfig, { Config } from "../../utils/config.js";
import { Connection, Database } from "duckdb-async";

////
/// Types
//

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof DbBaseCommand)["baseFlags"] & T["flags"]
>;

export type Args<T extends typeof Command> = Interfaces.InferredArgs<T["args"]>;

////
/// Exports
//

export const importNameArg = {
  importName: Args.string({
    required: true,
    name: "APINAME",
  }),
};

export abstract class DbBaseCommand<T extends typeof Command> extends Command {
  static override baseFlags = {};

  protected flags!: Flags<T>;
  protected args!: Args<T>;
  protected conf!: Config;
  protected duckDb!: Database;
  protected dbConn!: Connection;

  public override async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof DbBaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: true,
    });

    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
    this.conf = getConfig();

    try {
      this.duckDb = await Database.create(getConfig().dbOutputDir + "/pdpl.db");
      logger.printDebug("Created a DB");
    } catch (err) {
      console.log("❌ DB could not be created: " + (err as Error).message);
      process.exit(1);
    }

    try {
      this.dbConn = await this.duckDb.connect();
      logger.printDebug("Created a DB connection");
    } catch (err) {
      console.log("❌ DB could not be connected to: " + (err as Error).message);
      process.exit(1);
    }
  }

  protected override async catch(err: Error & { exitCode?: number }) {
    await super.catch(err);
    logger.error({ error: err.message });
  }

  protected override async finally(_: Error | undefined) {
    await super.finally(_);
    await this.dbConn.close();
    await this.duckDb.close();
  }
}
