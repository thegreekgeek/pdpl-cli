import { Connection } from "duckdb-async";

import { DbBaseCommand } from "./_base.js";
import getConfig from "../../utils/config.js";
import path from "path";
import { removeFile, writeFile } from "../../utils/fs.js";

export interface DbTransformation {
  getSourceTable: () => string;
  getSourceColumns: () => string[];
  transform: (data: object) => object;
  getDestinationTable: () => string;
}

export interface DuckDBConnection extends Connection {}

export default class TransformDb extends DbBaseCommand<typeof DbBaseCommand> {
  static override summary = "Build new tables from existing or transformed data";

  static override examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const { transformations, dbOutputDir } = getConfig();

    if (!transformations.length) {
      throw new Error("No transformations to run.");
    }

    for (const transformation of transformations) {
      const sourceTable = transformation.getSourceTable();
      const sourceCols = transformation.getSourceColumns();
      const results = await this.dbConn.all(`
        SELECT ${sourceCols.join(", ")}
        FROM '${sourceTable}'
        `);
      const transformed = transformation.transform(results);
      const destinationTable = transformation.getDestinationTable();

      // DuckDB does not support reading from a stringified JSON object
      // https://github.com/duckdb/duckdb/discussions/9558
      const jsonTmpFile = path.join(dbOutputDir, `${destinationTable}.json`);
      writeFile(jsonTmpFile, JSON.stringify(transformed));

      await this.dbConn.all(`
        DROP TABLE IF EXISTS "${destinationTable}"
      `);

      await this.dbConn.all(`
        CREATE TABLE "${destinationTable}" AS
          SELECT *
          FROM read_json('${jsonTmpFile}')
      `);

      removeFile(jsonTmpFile);
      console.log(
        `Created table ${destinationTable} from ${sourceTable} with ${results.length} rows`
      );
    }
  }
}
