// tests/visual/supabase-stub.js — stands in for src/lib/supabase.js inside the
// screen-capture harness (tests/visual/). Signed in as a fixed fake user;
// every query, RPC, realtime channel and storage call resolves empty, so
// nothing leaves the machine and the screens render from localStorage only.
var SESSION = {
  access_token: "harness-token",
  refresh_token: "harness-refresh",
  user: { id: "u_harness", email: "harness@example.invalid", user_metadata: { full_name: "Lindsey Border" } },
};
var EMPTY = { data: null, error: null, count: 0 };

// A query builder: every method returns the builder, awaiting it yields EMPTY.
function builder() {
  var p = Promise.resolve(EMPTY);
  var b = new Proxy(function () {}, {
    get: function (_t, k) {
      if (k === "then") return p.then.bind(p);
      if (k === "catch") return p.catch.bind(p);
      if (k === "finally") return p.finally.bind(p);
      return function () { return b; };
    },
    apply: function () { return b; },
  });
  return b;
}

function channel() {
  var c = { on: function () { return c; }, subscribe: function (cb) { if (typeof cb === "function") setTimeout(function () { cb("SUBSCRIBED"); }, 0); return c; }, unsubscribe: function () { return Promise.resolve("ok"); }, send: function () { return Promise.resolve("ok"); } };
  return c;
}

export var supabase = {
  auth: {
    getSession: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
    getUser: function () { return Promise.resolve({ data: { user: SESSION.user }, error: null }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    refreshSession: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
    setSession: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
    signOut: function () { return Promise.resolve({ error: null }); },
    signInWithPassword: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
    signUp: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
    updateUser: function () { return Promise.resolve({ data: { user: SESSION.user }, error: null }); },
    resetPasswordForEmail: function () { return Promise.resolve({ data: {}, error: null }); },
  },
  from: function () { return builder(); },
  rpc: function () { return builder(); },
  channel: channel,
  removeChannel: function () { return Promise.resolve("ok"); },
  removeAllChannels: function () { return Promise.resolve([]); },
  functions: { invoke: function () { return Promise.resolve(EMPTY); } },
  storage: { from: function () { return builder(); } },
};
export default supabase;
