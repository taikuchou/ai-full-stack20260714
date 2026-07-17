-- Migration: FK_Course_CourseGroup  ON DELETE CASCADE  ->  ON DELETE SET NULL
--
-- Why: CourseGroup_pkid is nullable (a Course may have no group — the UI's 無/none option).
-- With ON DELETE CASCADE, deleting a CourseGroup silently deleted every Course in it, and those
-- cascaded deletes bypassed RowAudit. SET NULL is the correct semantics: the courses survive with
-- their group cleared. See docs/features.md (Course FKs) and course.sql.
--
-- Safe to run once against an existing database. Idempotent: it only recreates the constraint if
-- the current one is not already SET NULL (delete_referential_action 2 = SET NULL).

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Course_CourseGroup'
      AND delete_referential_action <> 2   -- 0 = NO ACTION, 1 = CASCADE, 2 = SET NULL, 3 = SET DEFAULT
)
BEGIN
    ALTER TABLE [dbo].[Course] DROP CONSTRAINT [FK_Course_CourseGroup];

    ALTER TABLE [dbo].[Course] WITH CHECK ADD CONSTRAINT [FK_Course_CourseGroup]
        FOREIGN KEY ([CourseGroup_pkid]) REFERENCES [dbo].[CourseGroup] ([pkid])
        ON DELETE SET NULL;

    ALTER TABLE [dbo].[Course] CHECK CONSTRAINT [FK_Course_CourseGroup];

    PRINT 'FK_Course_CourseGroup recreated with ON DELETE SET NULL.';
END
ELSE
BEGIN
    PRINT 'FK_Course_CourseGroup already ON DELETE SET NULL (or missing) — no change.';
END

COMMIT TRANSACTION;
