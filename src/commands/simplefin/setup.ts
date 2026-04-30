import { Args, Command } from "@oclif/core";
import axios from "axios";

import { envWrite } from "../../utils/fs.js";

////
/// Exports
//

export default class SimplefinSetup extends Command {
  static override summary = "Connect a SimpleFIN account to PDPL";

  static override description = `Claims a SimpleFIN Access URL from a one-time SimpleFIN Token and saves it to your .env file.

Visit https://bridge.simplefin.org/simplefin/create (or your institution's SimpleFIN Server) to generate a SimpleFIN Token, then pass it to this command.`;

  static override examples = ["<%= config.bin %> <%= command.id %> SIMPLEFIN_TOKEN"];

  static override args = {
    token: Args.string({
      name: "TOKEN",
      required: true,
      description:
        "The SimpleFIN Token provided by your institution or the SimpleFIN Bridge",
    }),
  };

  public override async run(): Promise<void> {
    const { args } = await this.parse(SimplefinSetup);
    const token = (args["token"] as string).trim();

    let claimUrl: string;
    try {
      claimUrl = Buffer.from(token, "base64").toString("utf8").trim();
    } catch {
      this.error(
        "Could not Base64-decode the provided SimpleFIN Token. " +
          "The token must be a valid Base64-encoded URL string. Please check and try again."
      );
    }

    if (!claimUrl.startsWith("https://")) {
      this.error(
        "The decoded token does not look like a valid HTTPS URL. " +
          "Only SSL/TLS URLs are supported. Please check your token and try again."
      );
    }

    this.log(`Claiming Access URL from: ${claimUrl}`);

    let accessUrl: string;
    try {
      const response = await axios.post<string>(claimUrl);
      accessUrl = (response.data as string).trim();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        this.error(
          "❌ The claim request was rejected (403). The token may already have been used " +
            "or may be compromised. Please disable this token at your institution and " +
            "generate a new one."
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      this.error(`Failed to claim Access URL: ${message}`);
    }

    if (!accessUrl.startsWith("https://")) {
      this.error(
        "The returned Access URL does not use HTTPS. " +
          "Only SSL/TLS connections are supported. Please contact your institution."
      );
    }

    const existing = process.env["SIMPLEFIN_ACCESS_URL"] || "";
    if (existing) {
      this.log("⚠️  An existing SIMPLEFIN_ACCESS_URL will be replaced.");
    }
    envWrite("SIMPLEFIN_ACCESS_URL", accessUrl, existing);

    this.log("✅ SIMPLEFIN_ACCESS_URL saved to .env. Add 'simplefin' to your config to start fetching data.");
  }
}
