/** Additive collection registration. Existing student details stay in students JSON. */
export const studentDossierCollections: Record<string, [string?, string?]> = {
  learningRecords: ["studentId", "date"],
};
