import { sk } from "./sk";
import { en } from "./en";
import { cs } from "./cs";
import { hu } from "./hu";
import { ro } from "./ro";
import { it } from "./it";
import { de } from "./de";
import type { ExampleChapters } from "./types";

export const exampleChapterIds = ["healthcareExamples", "previousAutomationExamples"] as const;
const copies: Record<string, ExampleChapters> = { sk, en, cs, hu, ro, it, de };
export const getStatusListHelpExamples = (locale: string): ExampleChapters => copies[locale] ?? en;
