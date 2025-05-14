import { DbBaseCommand } from "./_base.js";
import getConfig from "../../utils/config.js";

export default class TransformDb extends DbBaseCommand<typeof DbBaseCommand> {
  static override summary = "Build new tables from existing or transformed data";

  static override examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const { transformations } = getConfig();

    if (!transformations.length) {
      throw new Error("No trasformations to run.");
    }

    for (const transformation of transformations) {
      console.log(transformation);
    }
  }
}
