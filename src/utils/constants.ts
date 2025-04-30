import { homedir } from "os";
import path from "path";

export const DEFAULT_CONFIG_DIR = path.join(homedir(), ".pdpl");
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "get.config.mjs");
export const DEFAULT_JSON_DIR = path.join(DEFAULT_CONFIG_DIR, "json");
export const DEFAULT_DB_DIR = path.join(DEFAULT_CONFIG_DIR, "db");
export const DEFAULT_FILES_DIR = path.join(DEFAULT_CONFIG_DIR, "files");
