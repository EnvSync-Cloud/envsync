use spacetimedb::{table, Timestamp};

/// Temporary response table for reducers that need to return data.
/// Clients pass a `request_id`, the reducer writes the result here,
/// and the client reads it via SQL query then calls cleanup.
#[table(public, accessor = reducer_response)]
pub struct ReducerResponse {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub request_id: String,
    /// JSON-encoded result data
    pub data: String,
    pub created_at: Timestamp,
}
