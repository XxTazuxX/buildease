package com.buildease.automation;

import com.buildease.common.Store;
import java.time.Instant;
import java.util.UUID;
import org.springframework.transaction.support.TransactionTemplate;

/** Shared bookkeeping for scheduled jobs that process one organization per transaction. */
final class AutomationRuns {
  private AutomationRuns() {}

  /**
   * Records a failed run in its own transaction. The job's transaction has already rolled back
   * (taking its STARTED marker with it), so this upserts the FAILED marker for the same slot. A
   * failure while recording is swallowed so one organization never stops the rest of the run.
   */
  static void recordFailure(
      Store db,
      TransactionTemplate transactions,
      UUID actor,
      UUID organization,
      String job,
      Instant scheduled,
      RuntimeException error) {
    try {
      transactions.executeWithoutResult(
          status -> {
            db.context(actor, organization);
            db.update(
                "insert into automation_runs(id,organization_id,job_key,scheduled_for,status,detail,completed_at) values (?,?,?,?,'FAILED',?,now()) "
                    + "on conflict(organization_id,job_key,scheduled_for) do update set status='FAILED',detail=excluded.detail,completed_at=now()",
                UUID.randomUUID(),
                organization,
                job,
                java.sql.Timestamp.from(scheduled),
                error.getClass().getSimpleName());
          });
    } catch (RuntimeException ignored) {
      // Best effort: the scheduler will retry on its next tick.
    }
  }
}
