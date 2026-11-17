import type { AiCitation, AiScopeInfo } from "./types";
import type { ToolExecution } from "./tools/registry";

/** One citation per executed tool, tied to the exact window it was read for. */
export function citationsFor(executions: ToolExecution[], scope: AiScopeInfo): AiCitation[] {
  return executions.map((execution) => ({
    tool: execution.toolName,
    label: execution.label,
    from: scope.from,
    to: scope.to,
    locationId: scope.locationId,
    locationName: scope.locationName,
    rows: execution.rows,
  }));
}
