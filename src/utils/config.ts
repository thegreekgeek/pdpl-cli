import { homedir } from "os";
import { existsSync, readdirSync } from "fs";
import path, { dirname } from "path";
import { config as dotenvConfig } from "dotenv";

import { makeDirectory, pathAccessible, pathExists } from "./fs.js";
import { ValidLogLevels } from "./logger.js";
import {
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_PATH,
  DEFAULT_DB_DIR,
  DEFAULT_FILES_DIR,
  DEFAULT_JSON_DIR,
  DEFAULT_TABLES_DIR,
} from "./constants.js";
import { fileURLToPath } from "url";
import { DbTransformation } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { PATH_TO_ENV, PDPL_PATH_TO_ENV } = process.env;

dotenvConfig({
  path: PATH_TO_ENV || PDPL_PATH_TO_ENV || path.join(DEFAULT_CONFIG_DIR, ".env"),
});

const {
  DEBUG_OUTPUT = "false",
  DEBUG_SAVE_MOCKS = "false",
  DEBUG_ALL = "false",
  LOG_LEVEL,
  PATH_TO_CONFIG,
} = process.env;

////
/// Types
//

export interface Config {
  jsonOutputDir: string;
  dbOutputDir: string;
  filesOutputDir: string;
  tablesInputDir: string;
  timezone: string;
  originDate: string;
  apis: Record<string, string[] | true>;
  dbs: Record<string, string[] | true>;
  imports: string[];
  logLevel: ValidLogLevels;
  compressJson: boolean;
  saveEmptyLogs: boolean;
  debugSaveMocks: boolean;
  debugOutputDir: string;
  debugCompressJson: boolean;
  transformations: DbTransformation[];
  // System set
  configFile: string | null;
  apisSupported: string[];
  importsSupported: string[];
  inputsSupported: string[];
  outputsSupported: string[];
  runLogFileLimit: number;
  // DEPRECATED
  outputDir?: string;
}

interface ConfigFile
  extends Partial<Omit<Config, "configFile" | "apisSupported" | "importsSupported">> {}

////
/// Helpers
//

const validLogLevels: ValidLogLevels[] = ["debug", "info", "warn", "success", "error"];

const defaultConfig: Config = {
  configFile: "GMT",
  timezone: "GMT",
  jsonOutputDir: DEFAULT_JSON_DIR,
  dbOutputDir: DEFAULT_DB_DIR,
  filesOutputDir: DEFAULT_FILES_DIR,
  tablesInputDir: DEFAULT_TABLES_DIR,
  originDate: "1900-01-01",
  apis: {},
  dbs: {},
  apisSupported: [],
  imports: [],
  importsSupported: [],
  inputsSupported: [],
  outputsSupported: [],
  compressJson: true,
  logLevel: "info",
  debugSaveMocks: false,
  saveEmptyLogs: true,
  debugOutputDir: path.join(DEFAULT_CONFIG_DIR, "json-DEBUG"),
  debugCompressJson: false,
  runLogFileLimit: 0,
  transformations: [],
};

const configPath = PATH_TO_CONFIG ? PATH_TO_CONFIG : DEFAULT_CONFIG_PATH;

let configImport: null | ConfigFile = null;
let attemptedImport = false;
if (!attemptedImport) {
  if (existsSync(configPath)) {
    try {
      configImport = (await import(configPath)) as object;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "<unknown error>";
      console.log(
        `❌ Config file ${configPath} exists but could not be loaded: ${errorMessage}`
      );
      process.exit(1);
    }
  }
  attemptedImport = true;
}

const normalizeDir = (dir: string) => {
  if (dir.at(0) === "~") {
    dir = path.join(homedir(), dir.slice(1));
  }

  if (!pathExists(dir)) {
    makeDirectory(dir);
  }

  if (!pathAccessible(dir)) {
    throw new Error(`Configured output dir "${dir}" cannot be accessed`);
  }

  return dir;
};

////
/// Export
//

let processedConfig: Config | null = null;
export default (): Config => {
  if (processedConfig !== null) {
    return processedConfig;
  }

  let localConfig: ConfigFile = {};
  if (configImport !== null) {
    localConfig = (configImport as { default: object }).default as ConfigFile;
  }

  // DEPRECATED
  if (localConfig.outputDir) {
    console.log(
      "⚠️  The 'outputDir' config option is deprecated. Use 'jsonOutputDir' instead."
    );
    if (!localConfig.jsonOutputDir) {
      localConfig.jsonOutputDir = localConfig.outputDir;
    }
    delete localConfig.outputDir;
  }

  processedConfig = Object.assign({}, defaultConfig, localConfig);
  processedConfig.configFile = configImport ? configPath : null;

  if (DEBUG_OUTPUT === "true" || DEBUG_ALL === "true") {
    processedConfig.jsonOutputDir =
      localConfig.debugOutputDir || defaultConfig.debugOutputDir;
    processedConfig.compressJson =
      localConfig.debugCompressJson || defaultConfig.debugCompressJson;
  }

  if (DEBUG_SAVE_MOCKS === "true" || DEBUG_ALL === "true") {
    processedConfig.debugSaveMocks = true;
  }

  if (LOG_LEVEL && validLogLevels.includes(LOG_LEVEL as ValidLogLevels)) {
    processedConfig.logLevel = LOG_LEVEL as ValidLogLevels;
  }

  if (DEBUG_ALL === "true") {
    processedConfig.logLevel = "debug";
  }

  processedConfig.jsonOutputDir = normalizeDir(processedConfig.jsonOutputDir);
  processedConfig.dbOutputDir = normalizeDir(processedConfig.dbOutputDir);
  processedConfig.tablesInputDir = normalizeDir(processedConfig.tablesInputDir);

  // If the output dir is defined locally, the files dir should follow
  processedConfig.filesOutputDir =
    localConfig.filesOutputDir || path.join(processedConfig.jsonOutputDir, "_files");

  if (!pathExists(processedConfig.filesOutputDir)) {
    makeDirectory(processedConfig.filesOutputDir);
  }

  const apisSupported = readdirSync(path.join(__dirname, "..", "apis"));
  for (const apiName of Object.keys(processedConfig.apis)) {
    if (!apisSupported.includes(apiName)) {
      throw new Error(`Configured API "${apiName}" is not supported`);
    }
  }
  processedConfig.apisSupported = apisSupported;

  const importsSupported = readdirSync(path.join(__dirname, "..", "imports"));
  for (const importName of processedConfig.imports) {
    if (!importsSupported.includes(importName)) {
      throw new Error(`Configured import "${importName}" is not supported`);
    }
  }
  processedConfig.importsSupported = importsSupported;

  // TODO: Need a better way to determine valid input data sources
  processedConfig.inputsSupported = readdirSync(processedConfig.jsonOutputDir).filter(
    (dirName) => ![".", "_"].includes(dirName[0])
  );

  // TODO: I don't love this
  const outputFiles = readdirSync(path.join(__dirname, "..", "outputs"));
  processedConfig.outputsSupported = [...new Set(outputFiles)];

  process.env.TZ = processedConfig.timezone;

  return processedConfig;
};
