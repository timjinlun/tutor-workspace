/** 学习观察独立成记录，不覆盖学员资料，不混入账目。 */
export interface LearningRecord {
  id: string;
  studentId: string;
  date: string;
  text: string;
  lessonId?: string;
  visibility: "internal" | "parent";
  createdAt: string;
  updatedAt: string;
}
export type LearningRecordInput = Pick<LearningRecord, "studentId" | "date" | "text" | "lessonId" | "visibility">;
