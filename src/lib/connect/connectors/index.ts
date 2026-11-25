import type { Connector } from "../types";
import { fileConnector } from "./file";
import { httpConnector } from "./http";
import { mockConnector } from "./mock";

/**
 * Connector implementations, keyed by provider id. A provider in the
 * catalogue with `status: "available"` must have an entry here; the registry
 * test asserts the two lists agree, so the UI can never offer a provider
 * with no implementation.
 */
const CONNECTORS: Record<string, Connector> = {
  "custom-api": httpConnector,
  file: fileConnector,
  mock: mockConnector,
};

export function getConnector(providerId: string): Connector | undefined {
  return CONNECTORS[providerId];
}

export function connectorIds(): string[] {
  return Object.keys(CONNECTORS);
}
