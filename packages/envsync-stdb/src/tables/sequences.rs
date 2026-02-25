use spacetimedb::table;

/// Counters for serial numbers and CRL numbers.
#[table(public, accessor = sequence)]
pub struct Sequence {
    #[primary_key]
    pub name: String,
    pub value: u64,
}
