import path from "path";
import { Flags } from "@oclif/core";

import { DbBaseCommand } from "./_base.js";
import getConfig from "../../utils/config.js";
import { ApiHandler, EpChronological } from "../../utils/types.js";
import { getLatestFile } from "../../utils/fs.js";
import logger from "../../utils/logger.js";

interface DbBuildHandler {
  api: string;
  endpoint: string;
  saveLatest: boolean;
  dupeIdentifier?: string;
}

export default class BuildDb extends DbBaseCommand<typeof DbBaseCommand> {
  static override summary =
    "Build tables from JSON files for enabled or indicated sources";

  static override examples = [
    "<%= config.bin %> <%= command.id %> API_NAME",
    "<%= config.bin %> <%= command.id %> API_NAME --api API_NAME",
    "<%= config.bin %> <%= command.id %> API_NAME --api API_NAME --endpoint ENDPOINT_NAME",
  ];

  static override flags = {
    api: Flags.string({
      char: "a",
      summary: "Only build tables for a specific API",
    }),
    endpoint: Flags.string({
      char: "e",
      summary: "Only build tables for a specific endpoint",
    }),
  };

  public async run(): Promise<void> {
    const { api: apiFlag, endpoint: endpointFlag }: Record<string, string> = this.flags;
    const dbConfig = getConfig().dbs;
    const enabledDbs = Object.keys(dbConfig);

    if (endpointFlag && !apiFlag) {
      throw new Error(`Endpoint flag requires an API flag.`);
    }

    if (apiFlag && !enabledDbs.includes(apiFlag)) {
      throw new Error(`API '${apiFlag}' is not enabled in the configuration.`);
    }

    const processDbs: string[] = apiFlag ? [apiFlag] : enabledDbs;
    const endpointHandlers: DbBuildHandler[] = [];
    for (const processDb of processDbs) {
      const { endpointsPrimary, endpointsSecondary } = (
        (await import(`../../apis/${processDb}/index.js`)) as {
          default: ApiHandler;
        }
      ).default;
      endpointHandlers.push(
        ...endpointsPrimary.map((endpoint) => ({
          api: processDb,
          endpoint: endpoint.getDirName(),
          saveLatest: !endpoint.isChronological(),
          dupeIdentifier: endpoint.isChronological()
            ? (endpoint as EpChronological).getIdentifierProp?.()
            : undefined,
        }))
      );
      endpointHandlers.push(
        ...endpointsSecondary.map((endpoint) => ({
          api: processDb,
          endpoint: endpoint.getDirName(),
          saveLatest: false,
          dupeIdentifier: endpoint.getIdentifierProp?.(),
        }))
      );
    }

    for (const handler of endpointHandlers) {
      const tableName = `${handler.api}__${handler.endpoint}`;
      logger.printDebug(`Building table: ${tableName}`);

      const endpointPath = path.join(
        getConfig().jsonOutputDir,
        handler.api,
        handler.endpoint
      );
      const dataPath = path.join(
        endpointPath,
        handler.saveLatest ? getLatestFile(endpointPath) : "*.json"
      );
      logger.printDebug(`Reading JSON from: ${dataPath}`);

      const readJsonOptions = [
        "union_by_name = true",
        "convert_strings_to_integers = true",
        "format = 'auto'",
        "records = true",
        "filename = true",
      ].join(", ");

      await this.dbConn.all(`
        CREATE OR REPLACE TABLE '${tableName}' AS
          SELECT * FROM read_json_auto('${dataPath}', ${readJsonOptions});
      `);

      if (!handler.saveLatest) {
        await this.dbConn.all(`
          CREATE OR REPLACE SEQUENCE seq_id START WITH 1;
          ALTER TABLE '${tableName}' ADD COLUMN _id INTEGER DEFAULT nextval('seq_id');
        `);
      }

      if (handler.dupeIdentifier) {
        await this.dbConn.all(`
          DELETE FROM '${tableName}'
          WHERE _id IN (
            SELECT _id FROM (
              SELECT _id, ROW_NUMBER() OVER (PARTITION BY ${handler.dupeIdentifier}) AS dupe_count 
              FROM '${tableName}'
            ) 
            WHERE dupe_count > 1
          );
        `);
      }
    }
  }
}
