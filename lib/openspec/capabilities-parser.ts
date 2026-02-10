export interface Capability {
  name: string;
  description: string;
  type: "new" | "modified";
}

export interface CapabilitiesResult {
  newCapabilities: Capability[];
  modifiedCapabilities: Capability[];
}

/**
 * Parse the Capabilities section from proposal.md content
 * Looking for:
 * ## Capabilities
 * ### New Capabilities
 * - `capability-name`: description
 * ### Modified Capabilities
 * - `existing-name`: what is changing
 */
export function parseCapabilities(proposalContent: string): CapabilitiesResult {
  const result: CapabilitiesResult = {
    newCapabilities: [],
    modifiedCapabilities: [],
  };

  const lines = proposalContent.split("\n");
  let currentSection: "new" | "modified" | null = null;

  for (const line of lines) {
    // Detect section headers
    if (/^###\s*New\s*Capabilities/i.test(line)) {
      currentSection = "new";
      continue;
    }
    if (/^###\s*Modified\s*Capabilities/i.test(line)) {
      currentSection = "modified";
      continue;
    }
    // Reset on new ## header
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      currentSection = null;
      continue;
    }

    if (!currentSection) continue;

    // Parse capability line: - `name`: description
    const match = line.match(/^-\s*`([^`]+)`\s*:\s*(.*)$/);
    if (match) {
      const [, name, description] = match;
      const capability: Capability = {
        name: name.trim(),
        description: description.trim(),
        type: currentSection,
      };
      if (currentSection === "new") {
        result.newCapabilities.push(capability);
      } else {
        result.modifiedCapabilities.push(capability);
      }
    }
  }

  return result;
}

/**
 * Check which capabilities have corresponding spec files
 */
export function checkCapabilityCoverage(
  capabilities: CapabilitiesResult,
  specFiles: { path: string; name: string }[],
): {
  covered: string[];
  missing: string[];
  extra: string[];
} {
  const allCapNames = [
    ...capabilities.newCapabilities.map((c) => c.name),
    ...capabilities.modifiedCapabilities.map((c) => c.name),
  ];

  // Normalize spec file paths to capability names
  // e.g., "dark-mode/spec.md" -> "dark-mode"
  const specCapNames = specFiles.map((f) => {
    const parts = f.path.split("/");
    return parts[0]; // First directory is the capability name
  });
  const uniqueSpecCaps = [...new Set(specCapNames)];

  const covered = allCapNames.filter((c) => uniqueSpecCaps.includes(c));
  const missing = allCapNames.filter((c) => !uniqueSpecCaps.includes(c));
  const extra = uniqueSpecCaps.filter((c) => !allCapNames.includes(c));

  return { covered, missing, extra };
}
