use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::reducer_response::reducer_response as ReducerResponseTable;

/// Clean up a reducer response after the client has read it.
#[reducer]
pub fn cleanup_response(ctx: &ReducerContext, request_id: String) -> Result<(), String> {
    if let Some(row) = ctx.db.reducer_response().request_id().find(request_id) {
        ctx.db.reducer_response().id().delete(row.id);
    }
    Ok(())
}

/// Bulk cleanup old reducer responses (call periodically).
#[reducer]
pub fn cleanup_old_responses(ctx: &ReducerContext, older_than_micros: i64) -> Result<(), String> {
    let cutoff = Timestamp::from_micros_since_unix_epoch(older_than_micros);
    let old_ids: Vec<u64> = ctx
        .db
        .reducer_response()
        .iter()
        .filter(|r| r.created_at < cutoff)
        .map(|r| r.id)
        .collect();
    for id in old_ids {
        ctx.db.reducer_response().id().delete(id);
    }
    Ok(())
}
