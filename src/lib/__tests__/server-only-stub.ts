// `server-only` is a build-time marker: Next resolves it to a module that
// throws if it is ever pulled into a client bundle, and it has no standalone
// package on disk. Vitest therefore cannot resolve it, which made every file in
// src/lib/data — the whole query layer — impossible to import from a unit test,
// including the pure helpers those files colocate with their queries.
//
// Aliased to this empty module in vitest.config.ts. It changes nothing about
// the app build, where the real marker still does its job.
export {};
