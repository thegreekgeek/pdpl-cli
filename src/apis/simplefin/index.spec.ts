import { AxiosResponse } from "axios";
import { EpChronological, EpSnapshot, ApiHandler } from "../../utils/types.js";
import { parseDayFromTransaction } from "./index.js";

describe("Module: SimpleFIN API handler", () => {
  let simplefinHandler: ApiHandler;

  beforeAll(async () => {
    process.env["SIMPLEFIN_ACCESS_URL"] =
      "https://user123:pass456@bridge.simplefin.org/simplefin";
    simplefinHandler = (
      (await import("./index.js")) as {
        default: ApiHandler;
      }
    ).default;
  });

  describe("Accounts endpoint", () => {
    let epHandler: EpSnapshot;

    beforeEach(() => {
      epHandler = simplefinHandler.endpointsPrimary.filter((handler) => {
        return handler.getDirName() === "accounts";
      })[0] as EpSnapshot;
    });

    it("uses the correct endpoint", () => {
      expect(epHandler.getEndpoint()).toEqual("accounts");
    });

    it("gets the correct params", () => {
      expect(epHandler.getParams!()).toEqual({ "balances-only": 1, version: 2 });
    });

    it("transforms a response to an accounts array", () => {
      const mockResponse = {
        data: {
          errlist: [],
          connections: [],
          accounts: [
            {
              id: "2930002",
              name: "Savings",
              conn_id: "CON-123",
              currency: "USD",
              balance: "100.23",
              "balance-date": 978366153,
              transactions: [],
            },
          ],
        },
      } as AxiosResponse;

      expect(epHandler.transformResponseData!(mockResponse)).toEqual([
        {
          id: "2930002",
          name: "Savings",
          conn_id: "CON-123",
          currency: "USD",
          balance: "100.23",
          "balance-date": 978366153,
          transactions: [],
        },
      ]);
    });

    it("returns an empty array when accounts are missing", () => {
      const mockResponse = {
        data: { errlist: [], connections: [], accounts: [] },
      } as AxiosResponse;
      expect(epHandler.transformResponseData!(mockResponse)).toEqual([]);
    });
  });

  describe("Transactions endpoint", () => {
    let epHandler: EpChronological;

    beforeEach(() => {
      epHandler = simplefinHandler.endpointsPrimary.filter((handler) => {
        return handler.getDirName() === "accounts--transactions";
      })[0] as EpChronological;
    });

    it("uses the correct endpoint", () => {
      expect(epHandler.getEndpoint()).toEqual("accounts");
    });

    it("gets default params with a start-date within the last week", () => {
      const params = epHandler.getParams!() as {
        "start-date": number;
        "end-date": number;
        version: number;
        pending: number;
      };
      expect(params.version).toEqual(2);
      expect(params.pending).toEqual(1);
      expect(params["end-date"]).toBeGreaterThan(params["start-date"]);
      const sevenDays = 7 * 24 * 60 * 60;
      expect(params["end-date"] - params["start-date"]).toBeLessThanOrEqual(
        sevenDays + 5
      );
    });

    it("gets the default historic params (no existing params)", () => {
      const params = epHandler.getHistoricParams() as {
        "start-date": number;
        "end-date": number;
        version: number;
        pending: number;
      };
      expect(params.version).toEqual(2);
      expect(params.pending).toEqual(1);
      const ninetyDays = 90 * 24 * 60 * 60;
      expect(params["end-date"] - params["start-date"]).toBeCloseTo(ninetyDays, -2);
    });

    it("steps back 90 days when given existing historic params", () => {
      const existingParams = {
        "start-date": 1700000000,
        "end-date": 1707776000,
        version: 2,
        pending: 1,
      };
      const nextParams = epHandler.getHistoricParams(existingParams) as {
        "start-date": number;
        "end-date": number;
      };
      expect(nextParams["end-date"]).toEqual(1700000000);
      const ninetyDays = 90 * 24 * 60 * 60;
      expect(nextParams["start-date"]).toEqual(1700000000 - ninetyDays);
    });

    it("flattens transactions from all accounts and annotates account_id", () => {
      const mockResponse = {
        data: {
          errlist: [],
          connections: [],
          accounts: [
            {
              id: "ACC-1",
              name: "Checking",
              conn_id: "CON-123",
              currency: "USD",
              balance: "200.00",
              "balance-date": 978366153,
              transactions: [
                {
                  id: "TX-1",
                  posted: 978360000,
                  amount: "-10.00",
                  description: "Coffee",
                },
              ],
            },
            {
              id: "ACC-2",
              name: "Savings",
              conn_id: "CON-123",
              currency: "USD",
              balance: "1000.00",
              "balance-date": 978366153,
              transactions: [
                {
                  id: "TX-2",
                  posted: 978361000,
                  amount: "50.00",
                  description: "Deposit",
                },
              ],
            },
          ],
        },
      } as AxiosResponse;

      expect(epHandler.transformResponseData!(mockResponse)).toEqual([
        {
          id: "TX-1",
          posted: 978360000,
          amount: "-10.00",
          description: "Coffee",
          account_id: "ACC-1",
        },
        {
          id: "TX-2",
          posted: 978361000,
          amount: "50.00",
          description: "Deposit",
          account_id: "ACC-2",
        },
      ]);
    });

    it("appends to existing transaction data", () => {
      const existing = [
        {
          id: "TX-0",
          posted: 978359000,
          amount: "-5.00",
          description: "Prior",
          account_id: "ACC-1",
        },
      ];
      const mockResponse = {
        data: {
          errlist: [],
          connections: [],
          accounts: [
            {
              id: "ACC-1",
              name: "Checking",
              conn_id: "CON-123",
              currency: "USD",
              balance: "200.00",
              "balance-date": 978366153,
              transactions: [
                {
                  id: "TX-1",
                  posted: 978360000,
                  amount: "-10.00",
                  description: "Coffee",
                },
              ],
            },
          ],
        },
      } as AxiosResponse;

      const result = epHandler.transformResponseData!(mockResponse, existing) as object[];
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "TX-0" });
      expect(result[1]).toMatchObject({ id: "TX-1" });
    });
  });
});

describe("parseDayFromTransaction", () => {
  it("returns the correct date from a posted timestamp", () => {
    // 978366153 = 2001-01-01 18:02:33 UTC
    expect(parseDayFromTransaction({ posted: 978366153 })).toEqual("2001-01-01");
  });

  it("falls back to transacted_at when posted is 0 (pending)", () => {
    // 793090572 = 1995-02-18 ~06:55 UTC
    expect(
      parseDayFromTransaction({ posted: 0, transacted_at: 793090572 })
    ).toEqual("1995-02-18");
  });

  it("returns epoch date when both timestamps are 0", () => {
    expect(parseDayFromTransaction({ posted: 0 })).toEqual("1970-01-01");
  });
});
