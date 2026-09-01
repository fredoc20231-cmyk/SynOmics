export type LegalPageId = "research" | "terms" | "privacy" | "ip";

export const LEGAL_PAGES: Record<
  LegalPageId,
  { title: string; kicker: string; sections: ReadonlyArray<{ heading: string; paragraphs: readonly string[] }> }
> = {
  research: {
    title: "Research & Educational Use",
    kicker: "SYNAPSE-O™",
    sections: [
      {
        heading: "Intended use",
        paragraphs: [
          "SYNAPSE-O is software for educational, scientific, and research use. It helps researchers explore questions, inspect evidence, analyze data they are authorized to use, and run bounded computations when those actions are verified and authorized.",
          "SYNAPSE-O is not a licensed professional, a medical device, or a substitute for independent scientific, clinical, financial, legal, or regulatory judgment.",
        ],
      },
      {
        heading: "Not professional advice",
        paragraphs: [
          "Outputs are not medical, financial, legal, or other professional advice. They are not a diagnosis, treatment recommendation, investment recommendation, or legal opinion.",
          "For consequential decisions, consult a qualified professional who can review the original evidence, data, and applicable standards of care or practice.",
        ],
      },
      {
        heading: "Predictions and estimates",
        paragraphs: [
          "Predictions, rankings, generated summaries, and computational results are estimates produced from the inputs, models, and sources available at the time of the request. They are not guarantees of future performance, clinical outcome, or experimental success.",
        ],
      },
      {
        heading: "User responsibility",
        paragraphs: [
          "You are responsible for how you use SYNAPSE-O, including reviewing outputs, checking cited sources, confirming that you are authorized to use any uploaded data, and complying with institutional, ethical, and legal requirements that apply to your work.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms / Disclaimer",
    kicker: "SYNAPSE-O™",
    sections: [
      {
        heading: "Agreement",
        paragraphs: [
          "By creating an account or using SYNAPSE-O, you agree to these terms. If you do not agree, do not use the software.",
        ],
      },
      {
        heading: "Age requirement",
        paragraphs: [
          "You must be at least 18 years old, or the age of majority in your jurisdiction if higher, to create an account and use SYNAPSE-O.",
        ],
      },
      {
        heading: "No professional advice",
        paragraphs: [
          "SYNAPSE-O is provided for research and educational use. It does not provide medical, financial, legal, or other professional advice. You remain responsible for obtaining qualified professional consultation before acting on consequential questions.",
        ],
      },
      {
        heading: "Software reliability",
        paragraphs: [
          "SYNAPSE-O is engineered with verification, provenance, and execution controls intended to make scientific workflows inspectable. Those controls prove compliance with an explicit software specification when a check runs—not correspondence with reality, completeness of the literature, or clinical validity.",
          "The software may be unavailable, incomplete, or incorrect. Answers can omit relevant evidence, misread a source, or fail a quality gate. Do not treat generated text as an authoritative record.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "Use SYNAPSE-O only for lawful, authorized purposes. Do not attempt to bypass access controls, authorization, or execution sandboxes except where such restriction is prohibited by applicable law. Do not upload information you are not authorized to process.",
        ],
      },
      {
        heading: "Reporting problems",
        paragraphs: [
          "If you discover a security vulnerability, a software defect, or a scientific error in SYNAPSE-O behavior, report it promptly through the project’s issue channel or an administrator. Do not exploit a vulnerability or silently rely on a known defect.",
        ],
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          "To the extent permitted by applicable law, Sheen Studios and its contributors are not liable for decisions, losses, or outcomes arising from use of SYNAPSE-O. The software is provided as-is for research and educational use.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy",
    kicker: "SYNAPSE-O™",
    sections: [
      {
        heading: "What SYNAPSE processes",
        paragraphs: [
          "SYNAPSE-O processes account information, researcher profile details, conversations, uploaded files, project metadata, operational logs, and related workspace records in order to provide the service, enforce access control, and retain audit lineage required by governed workflows.",
        ],
      },
      {
        heading: "Storage",
        paragraphs: [
          "Conversations and related artifacts may be stored so you can resume work, so administrators can operate the workspace, and so governed actions can retain an inspectable record. SYNAPSE-O does not claim that conversations are never stored.",
          "Retention, deletion, and export remain subject to the workspace’s governance, institutional agreements, and applicable law. Only submit information you are authorized to use.",
        ],
      },
      {
        heading: "Deletion and retention",
        paragraphs: [
          "Deleting a conversation removes it from normal workspace access. It will not reappear in ordinary chats, projects, or conversation APIs.",
          "Audit, provenance, security, integrity, and compliance records required for governed operation may be retained according to workspace policy, institutional agreements, and applicable law. SYNAPSE-O does not claim that deleted content is always physically erased immediately, and it does not claim that every deleted record is retained indefinitely.",
        ],
      },
      {
        heading: "Access",
        paragraphs: [
          "Workspace operators and administrators may access operational records as needed to run, secure, and audit the system. Session credentials are stored in HttpOnly cookies and must not be placed in localStorage.",
        ],
      },
    ],
  },
  ip: {
    title: "Intellectual Property",
    kicker: "SYNAPSE-O™",
    sections: [
      {
        heading: "Ownership",
        paragraphs: [
          "SYNAPSE-O, including its proprietary code, algorithms, architecture, models of interaction, documentation, and associated intellectual property, is owned by Sheen Studios®. All rights not expressly granted are reserved.",
        ],
      },
      {
        heading: "License restrictions",
        paragraphs: [
          "You may not copy, modify, distribute, reverse engineer, decompile, disassemble, or circumvent technical protections of SYNAPSE-O, and you may not relicense the software, except to the extent that applicable law prohibits these restrictions or an express written license permits them.",
        ],
      },
      {
        heading: "Third-party materials",
        paragraphs: [
          "Cited literature, public datasets, and user-uploaded materials remain subject to their own licenses, copyrights, and access terms. Display of a source does not transfer rights in that source.",
        ],
      },
      {
        heading: "Marks",
        paragraphs: [
          "SYNAPSE-O™ and Sheen Studios® are marks of their owner. Unauthorized use of those marks is prohibited.",
        ],
      },
    ],
  },
};

export const LEGAL_FOOTER_LINKS: ReadonlyArray<{ id: LegalPageId; label: string; href: string }> = [
  { id: "research", label: "Research & educational use", href: "#/legal/research" },
  { id: "terms", label: "Terms", href: "#/legal/terms" },
  { id: "privacy", label: "Privacy", href: "#/legal/privacy" },
  { id: "ip", label: "Intellectual Property", href: "#/legal/ip" },
];

export function legalPageFromHash(hash: string): LegalPageId | null {
  const match = hash.match(/^#\/legal\/(research|terms|privacy|ip)\/?$/);
  return match ? (match[1] as LegalPageId) : null;
}
