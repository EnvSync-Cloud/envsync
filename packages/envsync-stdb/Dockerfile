FROM clockworklabs/spacetime:latest AS builder

RUN rustup target add wasm32-unknown-unknown
RUN spacetime --version

WORKDIR /build
COPY Cargo.toml Cargo.lock* ./
COPY src/ src/

RUN spacetime build

ENTRYPOINT ["spacetime", "publish", "--server", "http://spacetimedb:3000", "envsync-kms", "-b", "/build/target/wasm32-unknown-unknown/release/envsync_stdb.wasm", "-y"]
