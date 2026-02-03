"use server";
import { getArtifactContent, saveArtifact } from "@/lib/openspec/service";
import type { ArtifactType } from "@/lib/openspec/types";

export async function loadArtifact(changeId: string, type: ArtifactType) {
  return await getArtifactContent(changeId, type);
}

export async function updateArtifact(
  changeId: string,
  type: ArtifactType,
  content: string,
) {
  await saveArtifact(changeId, type, content);
}
