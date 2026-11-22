import { describe, expect, test } from "bun:test";

import {
  enterpriseProviderUi,
  extractKnownFieldValues,
  mergeFieldValuesIntoRecord,
  omitKnownFields,
} from "../src/lib/enterprise-provider-ui";

const fields = enterpriseProviderUi.circleci.connectionAuthFields;

describe("CircleCI connection form storage", () => {
  test("stores a token reference separately from plain text fields", () => {
    expect(mergeFieldValuesIntoRecord(
      fields,
      { api_token: "  ci-token-reference  ", context_id: "  context-id  " },
      { api_token: "legacy-token", org_id: "legacy-context" },
    )).toEqual({
      api_token_secret_ref: "ci-token-reference",
      context_id: "context-id",
      org_id: "legacy-context",
    });
  });

  test("hydrates a saved secret reference in preference to a legacy token field", () => {
    expect(extractKnownFieldValues(
      { api_token: "legacy-token", api_token_secret_ref: "saved-reference", context_id: "ctx" },
      fields,
    )).toEqual({ api_token: "saved-reference", context_id: "ctx" });
    expect(extractKnownFieldValues({ api_token: "legacy-token" }, fields)).toEqual({
      api_token: "legacy-token",
      context_id: "",
    });
  });

  test("clears both representations of a removed token and preserves unrelated config", () => {
    const saved = {
      api_token: "legacy-token",
      api_token_secret_ref: "saved-reference",
      context_id: "ctx",
      org_id: "legacy-context",
    };
    expect(mergeFieldValuesIntoRecord(fields, { api_token: " ", context_id: "ctx" }, saved)).toEqual({
      context_id: "ctx",
      org_id: "legacy-context",
    });
    expect(omitKnownFields(saved, fields)).toEqual({ org_id: "legacy-context" });
  });
});
