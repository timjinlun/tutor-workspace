# Teaching management implementation plan

**Goal:** Replace the long course settings page with discoverable course, class and teacher tabs, explicit editors, and compact readable summaries.

**Architecture:** Keep persisted Course/Class/Teacher models and existing store/repository behavior. Independent UI packages `course-catalog`, `class-management`, and `teacher-management` accept props and command callbacks; `features/courses` composes them. Pure draft validation is separate from views. No sibling-module imports, schema changes, added dependencies or network behavior.

**Tech stack:** React, TypeScript, existing primitives and CSS tokens, Electron, Vitest.

## Execution (single authorized implementation pass)

1. Add failing tests for course/teacher draft validation (empty names, nonfinite/negative values, optional defaults, zero fees). Implement pure validators in `src/core/catalog-forms.ts`.
2. Add generic presentation primitives in `src/ui/primitives/SetupPanel.tsx` and `setup-panel.css`. Implement independent lists and modal editors in the three UI modules. Editing is draft-only until save; cancellation never changes stored objects.
3. Replace `src/ui/features/courses/CoursesPage.tsx` with aggregation and accessible persistent tabs. Replace courses.css with shell styles; migrate the old ClassSheet to class-management. Rename sidebar entry to 教学管理. Preserve unrelated shared CSS consumers.
4. Validate tests, typecheck, lint/module boundaries and build. Verify actual rendered tabs, course price/duration summaries, cancel/save, class member/absence/teacher settings, teacher name/color/pay, limits, 920px and dark mode. Use isolated synthetic data, never replace the user's database.
5. Commit scoped files, fast-forward merge into main, package signed arm64 App, back up and replace local installed App, verify signature and bundle hashes. No push, tags or Release publication.
