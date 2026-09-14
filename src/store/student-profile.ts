import type { State } from "@/core/types";
import { editStudentProfile } from "@/core/student-profile/commands";
import type { StudentProfileInput } from "@/core/student-profile/types";
import type { CommandResult } from "@/core/command-result";

export interface StudentProfileActions { editStudentProfile(id: string, input: StudentProfileInput): CommandResult }
export function createStudentProfileActions(read: () => State, commit: (patch: Partial<State>) => void): StudentProfileActions {
  return { editStudentProfile(id, input) {
    const result = editStudentProfile(read(), id, input);
    if (!result.ok) return result;
    commit({ students: result.students });
    return { ok: true };
  } };
}
