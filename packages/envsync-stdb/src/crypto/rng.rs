use spacetimedb::ReducerContext;
use spacetimedb::rand::Rng;

/// Fill a buffer with random bytes from SpaceTimeDB's context RNG.
pub fn fill_random(ctx: &ReducerContext, buf: &mut [u8]) {
    let mut rng = ctx.rng();
    rng.fill(buf);
}

/// Generate a random byte vector of given length.
pub fn random_bytes(ctx: &ReducerContext, len: usize) -> Vec<u8> {
    let mut buf = vec![0u8; len];
    fill_random(ctx, &mut buf);
    buf
}

/// Create a seeded StdRng from SpaceTimeDB's RNG.
/// This is needed for crates requiring CryptoRng + RngCore (e.g. RSA).
pub fn seeded_std_rng(ctx: &ReducerContext) -> spacetimedb::rand::rngs::StdRng {
    use spacetimedb::rand::SeedableRng;
    let mut seed = [0u8; 32];
    fill_random(ctx, &mut seed);
    spacetimedb::rand::rngs::StdRng::from_seed(seed)
}
