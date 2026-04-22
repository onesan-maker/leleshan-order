export type FlavorMode = "required" | "inherit" | "none";
export type StapleMode = "required" | "none";

export interface TypeRule {
  flavorMode: FlavorMode;
  stapleMode: StapleMode;
}

const TYPE_RULES: Record<string, TypeRule> = {
  set:           { flavorMode: "required", stapleMode: "required" },
  addon:         { flavorMode: "inherit",  stapleMode: "none" },
  staple_rice:   { flavorMode: "none",     stapleMode: "none" },
  staple_noodle: { flavorMode: "inherit",  stapleMode: "none" },
  drink:         { flavorMode: "none",     stapleMode: "none" },
  other:         { flavorMode: "none",     stapleMode: "none" },
};

const DEFAULT_RULE: TypeRule = { flavorMode: "none", stapleMode: "none" };

export function getTypeRule(posType: string | undefined): TypeRule {
  return TYPE_RULES[posType ?? ""] ?? DEFAULT_RULE;
}

export function needsSpecModal(posType: string | undefined): boolean {
  const rule = getTypeRule(posType);
  return rule.flavorMode === "required" || rule.stapleMode === "required";
}
