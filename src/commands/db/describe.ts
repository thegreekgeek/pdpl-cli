import { Flags } from "@oclif/core";
import { DbBaseCommand } from "./_base.js";

export default class BuildDb extends DbBaseCommand<typeof DbBaseCommand> {
  static override summary = "Describe tables built from raw JSON data";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --api API_NAME",
    "<%= config.bin %> <%= command.id %> --api API_NAME --endpoint ENDPOINT_NAME",
  ];

  static override flags = {
    api: Flags.string({
      char: "a",
      summary: "Only describe tables built for a specific API",
    }),
    endpoint: Flags.string({
      char: "e",
      summary: "Only describe tables built for a specific endpoint",
    }),
  };

  public async run(): Promise<void> {
    const { api: apiFlag, endpoint: endpointFlag }: Record<string, string> = this.flags;

    if (endpointFlag && !apiFlag) {
      throw new Error(`Endpoint flag requires an API flag.`);
    }

    const allTables = (await this.dbConn.all(`SHOW TABLES`)).map(
      (table) => (table as { name: string })["name"]
    );
    for (const table of allTables) {
      if (apiFlag && !endpointFlag && !table.startsWith(`${apiFlag}__`)) {
        continue;
      }
      if (apiFlag && endpointFlag && table !== `${apiFlag}__${endpointFlag}`) {
        continue;
      }
      console.log(`\n======\nDescribing table: ${table}\n======`);
      (await this.dbConn.all(`DESCRIBE TABLE '${table}'`)).forEach((column) => {
        console.log(`  ${column["column_name"]} => ${column["column_type"]}`);
      });
    }
  }
}
