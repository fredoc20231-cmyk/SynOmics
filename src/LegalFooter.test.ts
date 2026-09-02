import { expect, test } from "vitest";
import { LEGAL_NOTICE } from "./LegalFooter";

test("legal notice uses proper language", () => {
  expect(LEGAL_NOTICE).toBe(
    "SynOmics™ · Private Research Beta · Designed to verify, challenge, and trace claims—not just generate them · Research & educational use only · Not medical advice · Terms",
  );
  expect(LEGAL_NOTICE.toLowerCase()).not.toContain("propriteary");
  expect(LEGAL_NOTICE.toLowerCase()).not.toContain("owneed");
  expect(LEGAL_NOTICE).not.toContain("α");
  expect(LEGAL_NOTICE.toLowerCase()).not.toContain("all other ai tools make mistakes");
  expect(LEGAL_NOTICE.toLowerCase()).not.toContain("hallucination-free");
});
