import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Cron } from "croner";
import { CacheJobsConfig } from "./CacheJobsConfig.js";

describe("CacheJobsConfig.isEnabled", () => {
  test("enables scheduling only for the exact string true", () => {
    assert.equal(CacheJobsConfig.isEnabled("true"), true);
  });

  test("disables scheduling for a missing, empty, or any other value", () => {
    for (const flag of [undefined, "", "TRUE", "True", " true", "true ", "1", "yes", "false"]) {
      assert.equal(CacheJobsConfig.isEnabled(flag), false);
    }
  });
});

describe("CacheJobsConfig.atendimentosRefreshPattern", () => {
  test("uses the default when the override is missing or blank", () => {
    for (const override of [undefined, "", "   "]) {
      assert.equal(
        CacheJobsConfig.atendimentosRefreshPattern(override),
        CacheJobsConfig.DEFAULT_ATENDIMENTOS_REFRESH_PATTERN,
      );
    }
  });

  test("uses the trimmed override when set", () => {
    assert.equal(CacheJobsConfig.atendimentosRefreshPattern(" 0 2 * * * "), "0 2 * * *");
  });
});

describe("CacheJobsConfig default atendimentos refresh schedule", () => {
  const schedule = new Cron(CacheJobsConfig.DEFAULT_ATENDIMENTOS_REFRESH_PATTERN, {
    timezone: CacheJobsConfig.TIMEZONE,
  });

  test("runs at 01:00 America/Sao_Paulo", () => {
    const nextRun = schedule.nextRun(new Date("2026-10-16T00:00:00Z"));
    assert.equal(nextRun?.toISOString(), "2026-10-16T04:00:00.000Z");
  });

  test("waits for the next day once today's run time has passed", () => {
    const nextRun = schedule.nextRun(new Date("2026-10-16T05:00:00Z"));
    assert.equal(nextRun?.toISOString(), "2026-10-17T04:00:00.000Z");
  });
});
