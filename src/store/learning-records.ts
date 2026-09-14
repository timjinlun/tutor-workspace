import type { State } from "@/core/types";
import type { LearningRecordInput } from "@/core/learning-records/types";
import type { CommandResult } from "@/core/command-result";
import { saveLearningRecord } from "@/core/learning-records/commands";
import { uid } from "@/core/id";

export interface LearningRecordActions {
  saveLearningRecord(input: LearningRecordInput, id?: string): CommandResult;
  removeLearningRecord(id: string): void;
}
export function createLearningRecordActions(read: () => State, commit: (patch: Partial<State>) => void): LearningRecordActions {
  return {
    saveLearningRecord(input, id) {
      const result = saveLearningRecord(read(), input, id ?? uid("lr"), new Date().toISOString(), !!id);
      if (!result.ok) return result;
      commit({ learningRecords: result.records });
      return { ok: true };
    },
    removeLearningRecord(id) { commit({ learningRecords: read().learningRecords.filter((r) => r.id !== id) }); },
  };
}
