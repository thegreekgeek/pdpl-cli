import { AxiosResponse } from "axios";
import { ApiHandler, EpChronological } from "../../utils/types.js";

describe("Module: Reddit API handler", () => {
  let redditHandler: ApiHandler;

  beforeAll(async () => {
    process.env["REDDIT_USER_NAME"] = "test-user";
    redditHandler = (
      (await import(`./index.js`)) as {
        default: ApiHandler;
      }
    ).default;
  });

  describe("Comments endpoint", () => {
    let epHandler: EpChronological;

    beforeEach(() => {
      epHandler = redditHandler.endpointsPrimary.filter((handler) => {
        return (
          handler.getEndpoint() === `user/${process.env["REDDIT_USER_NAME"]}/comments`
        );
      })[0] as EpChronological;
    });

    it("gets the correct default params", () => {
      expect(epHandler.getParams!()).toEqual({
        limit: 100,
      });
    });

    it("transforms the response", () => {
      expect(
        epHandler.transformResponseData!({
          data: {
            data: { children: [{ data: {} }] },
          },
        } as AxiosResponse)
      ).toEqual([{ data: {} }]);
    });

    it("parses the correct date from the response", () => {
      expect(epHandler.parseDayFromEntity({ data: { created: 1705029840 } })).toEqual(
        "2024-01-11"
      );
    });

    it("gets the correct default historic params", () => {
      expect(epHandler.getHistoricParams()).toEqual({ limit: 100 });
    });

    it("gets the correct next historic params", () => {
      expect(epHandler.getHistoricParams({}, { data: { after: "AFTER" } })).toEqual({
        limit: 100,
        after: "AFTER",
      });
    });
  });

  describe("Submitted endpoint", () => {
    let epHandler: EpChronological;

    beforeEach(() => {
      epHandler = redditHandler.endpointsPrimary.filter((handler) => {
        return (
          handler.getEndpoint() === `user/${process.env["REDDIT_USER_NAME"]}/submitted`
        );
      })[0] as EpChronological;
    });

    it("gets the correct default params", () => {
      expect(epHandler.getParams!()).toEqual({
        limit: 100,
      });
    });

    it("transforms the response", () => {
      expect(
        epHandler.transformResponseData!({
          data: {
            data: { children: [{ data: {} }] },
          },
        } as AxiosResponse)
      ).toEqual([{ data: {} }]);
    });

    it("parses the correct date from the response", () => {
      expect(epHandler.parseDayFromEntity({ data: { created: 1705029840 } })).toEqual(
        "2024-01-11"
      );
    });

    it("gets the correct next historic params", () => {
      expect(epHandler.getHistoricParams({}, { data: { after: "AFTER" } })).toEqual({
        limit: 100,
        after: "AFTER",
      });
    });
  });
});
