import { AxiosError, AxiosResponse } from "axios";

import {
  ApiHandler,
  EpChronological,
  EpSecondary,
  EpSnapshot,
} from "../../utils/types.js";
import {
  ONE_DAY_IN_SEC,
  ONE_WEEK_IN_SEC,
  HALF_HOUR_IN_SEC,
  QUARTER_YEAR_IN_SEC,
  getEpochNow,
  getFormattedDate,
} from "../../utils/date-time.js";

const { SIMPLEFIN_ACCESS_URL = "" } = process.env;

////
/// Types
//

interface SimplefinTransaction {
  id: string;
  posted: number;
  amount: string;
  description: string;
  transacted_at?: number;
  pending?: boolean;
  extra?: object;
  account_id?: string;
}

interface SimplefinAccount {
  id: string;
  name: string;
  conn_id: string;
  currency: string;
  balance: string;
  "available-balance"?: string;
  "balance-date": number;
  transactions?: SimplefinTransaction[];
  extra?: object;
}

interface SimplefinAccountSet {
  errlist: object[];
  connections: object[];
  accounts: SimplefinAccount[];
}

interface SimplefinTransactionParams {
  "start-date"?: number;
  "end-date"?: number;
  version: number;
  pending: number;
}

interface SimplefinBalanceParams {
  "balances-only": number;
  version: number;
}

////
/// Helpers
//

const parseAccessUrl = (accessUrl: string) => {
  const url = new URL(accessUrl);
  return {
    baseUrl: `${url.protocol}//${url.host}${url.pathname}/`,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
};

const getTransactionHistoricParams = (
  currentParams?: object
): SimplefinTransactionParams => {
  const params = currentParams as SimplefinTransactionParams | undefined;
  const ninetyDaysInSec = ONE_DAY_IN_SEC * 90;
  if (params && typeof params["start-date"] === "number") {
    const prevStart = params["start-date"];
    return {
      "start-date": prevStart - ninetyDaysInSec,
      "end-date": prevStart,
      version: 2,
      pending: 1,
    };
  }
  const now = getEpochNow();
  return {
    "start-date": now - ninetyDaysInSec,
    "end-date": now,
    version: 2,
    pending: 1,
  };
};

const transformAccountsResponse = (response: AxiosResponse): SimplefinAccount[] => {
  const data = response.data as SimplefinAccountSet;
  return data.accounts || [];
};

const transformTransactionsResponse = (
  response: AxiosResponse,
  existingData?: [] | object
): SimplefinTransaction[] => {
  const existing = Array.isArray(existingData)
    ? (existingData as SimplefinTransaction[])
    : [];
  const data = response.data as SimplefinAccountSet;
  const transactions: SimplefinTransaction[] = [];
  for (const account of data.accounts || []) {
    for (const tx of account.transactions || []) {
      transactions.push({ ...tx, account_id: account.id });
    }
  }
  return [...existing, ...transactions];
};

export const parseDayFromTransaction = (entity: object): string => {
  const tx = entity as SimplefinTransaction;
  const timestamp = tx.posted || tx.transacted_at || 0;
  return getFormattedDate(0, new Date(timestamp * 1000));
};

const handleAccountsApiError = (apiError: AxiosError) => {
  if (apiError.response?.status === 403) {
    console.log(
      "❌ SimpleFIN returned 403: access has been revoked or credentials are invalid. " +
        "Re-run the setup command to obtain a new Access URL."
    );
  }
};

////
/// Exports
//

const isReady = () => !!SIMPLEFIN_ACCESS_URL;
const getApiName = () => "simplefin";
const getApiBaseUrl = () => {
  if (!SIMPLEFIN_ACCESS_URL) return "";
  return parseAccessUrl(SIMPLEFIN_ACCESS_URL).baseUrl;
};

const getApiAuthHeaders = async (): Promise<{ [key: string]: string }> => {
  const headers: { [key: string]: string } = {};
  if (!SIMPLEFIN_ACCESS_URL) return headers;
  const { username, password } = parseAccessUrl(SIMPLEFIN_ACCESS_URL);
  headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  return headers;
};

const endpointsPrimary: (EpChronological | EpSnapshot)[] = [
  {
    isChronological: () => false,
    getEndpoint: () => "accounts",
    getDirName: () => "accounts",
    getParams: (): SimplefinBalanceParams => ({ "balances-only": 1, version: 2 }),
    getDelay: () => ONE_DAY_IN_SEC,
    transformResponseData: transformAccountsResponse,
    handleApiError: handleAccountsApiError,
  },
  {
    isChronological: () => true,
    getEndpoint: () => "accounts",
    getDirName: () => "accounts--transactions",
    getParams: (): SimplefinTransactionParams => ({
      "start-date": getEpochNow() - ONE_WEEK_IN_SEC,
      "end-date": getEpochNow(),
      version: 2,
      pending: 1,
    }),
    getDelay: () => ONE_DAY_IN_SEC,
    getHistoricParams: getTransactionHistoricParams,
    getHistoricDelay: (continuation?: boolean) =>
      continuation ? HALF_HOUR_IN_SEC : QUARTER_YEAR_IN_SEC,
    parseDayFromEntity: parseDayFromTransaction,
    transformResponseData: transformTransactionsResponse,
    getIdentifierProp: () => "id",
    handleApiError: handleAccountsApiError,
  },
];

const endpointsSecondary: EpSecondary[] = [];

const handler: ApiHandler = {
  isReady,
  getApiName,
  getApiBaseUrl,
  getApiAuthHeaders,
  endpointsPrimary,
  endpointsSecondary,
};

export default handler;
