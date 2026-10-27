export type HelpExample = { title: string; paragraphs: string[] };
export type ExampleSection = { title: string; paragraphs: string[]; examples: HelpExample[] };
export type ExampleChapters = Record<"healthcareExamples" | "previousAutomationExamples", ExampleSection>;
