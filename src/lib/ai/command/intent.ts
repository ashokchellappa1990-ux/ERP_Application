import { findTxType, type TxType } from "./transactions";
import { findNavTarget, type NavTarget } from "./navigation";

/** Detect a COMMAND intent (create a transaction / navigate to a screen). Returns null
 *  for everything else — those fall through to the BI/query engine. Data questions like
 *  "show today's sales" are intentionally NOT navigation; they're answered by BI. */
export type CommandIntent =
  | { kind: "create"; tx: TxType }
  | { kind: "navigate"; target: NavTarget }
  | null;

const CREATE_VERB = /\b(create|add a|add new|new|generate|make|raise|prepare|draft|register)\b/;
const NAV_VERB = /\b(open|go to|goto|navigate to|navigate|take me to|launch|bring up|show me the)\b/;

export function detectCommandIntent(message: string): CommandIntent {
  const q = message.toLowerCase();

  // CREATE — an action verb + a known transaction type.
  if (CREATE_VERB.test(q)) {
    const tx = findTxType(q);
    if (tx) return { kind: "create", tx };
  }

  // NAVIGATE — an explicit "open/go to…" verb, or a bare screen/master/dashboard name.
  const target = findNavTarget(q);
  if (target && (NAV_VERB.test(q) || /\b(master|dashboard|screen|page)\b/.test(q))) return { kind: "navigate", target };

  return null;
}
