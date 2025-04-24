import { Command } from "@oclif/core";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { load as loadYaml } from "js-yaml";
import path from "path";

const { PATH_TO_DEVLOG_SOURCE } = process.env;

export default class Log extends Command {
  static override summary = "Pull in devlogs from a local Obsidian";
  static override hidden = true;

  public async run(): Promise<void> {
    if (!PATH_TO_DEVLOG_SOURCE || !existsSync(PATH_TO_DEVLOG_SOURCE)) {
      console.log("Invalid or missing devlog source path");
      process.exit(1);
    }

    const devlogDest = path.join(process.cwd(), "docs", "devlog");
    if (!existsSync(devlogDest)) {
      console.log(
        `Devlogs path ${devlogDest} does not exist. Are you in the project root?`
      );
      process.exit(1);
    }

    for (const file of readdirSync(PATH_TO_DEVLOG_SOURCE, { withFileTypes: true })) {
      if (!file.isFile()) {
        continue;
      }

      const fullPath = path.join(file.parentPath, file.name);
      const fileContent = readFileSync(fullPath, { encoding: "utf-8" });
      const fileParts = fileContent.split("---");

      if (fileParts[0] !== "" || fileParts.length < 3) {
        continue;
      }
      console.log(`Reading: ${file.name}`);

      const frontMatter = loadYaml(fileParts[1]) as { tags?: string[] };
      const { tags = [] } = frontMatter;

      if (tags && tags.includes("artifact/devlog") && tags.includes("topic/pdpl")) {
        console.log(`Writing: ${file.name}`);
        const newFileName = file.name.split(" - ")[0].split("T")[0] + ".md";
        const newFilePath = path.join(devlogDest, newFileName);
        writeFileSync(newFilePath, fileParts[2]);
      }
    }
  }
}
