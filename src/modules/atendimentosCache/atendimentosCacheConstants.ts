// Shared by the source, cache, and lookup job connections; SQL timeouts cannot bound connection setup.
export const REFRESH_CONNECTION_OPTIONS = {
  statement_timeout: 15 * 60 * 1000,
  connectionTimeoutMillis: 30 * 1000,
  application_name: "refreshAtendimentosCache",
};

// Fixed key for this dataset's refresh; other cached datasets must use their own keys.
export const REFRESH_LOCK_KEY = 728_361_540;

export const FETCH_SIZE = 10000;
