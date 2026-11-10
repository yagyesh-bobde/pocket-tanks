import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productionVisitor,
  cleanEvent,
  createAnalytics,
} from "../src/analytics.js";

const live = {
  hostname: "yagyesh-bobde.github.io",
  pathname: "/pocket-tanks/",
  search: "",
};
function fixture(extra = {}) {
  const data = new Map(),
    sent = [],
    config = {};
  const client = {
    capture: (event, properties) => sent.push({ event, properties }),
    register: (properties) => {
      config.registered = properties;
    },
    opt_out_capturing: () => {
      config.optedOut = true;
    },
    opt_in_capturing: () => {
      config.optedIn = true;
    },
    init: (key, options) => {
      Object.assign(config, options);
      options.loaded(client);
    },
  };
  const storage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  const options = {
    location: live,
    env: { VITE_POSTHOG_KEY: "phc_test" },
    navigator: {},
    storage,
    load: async () => ({ default: client }),
    ...extra,
  };
  return { data, sent, config, options };
}

test("analytics only runs on the published game, never LAN/development or review fixtures", () => {
  assert.equal(productionVisitor(live, "phc_test"), true);
  for (const location of [
    { ...live, hostname: "localhost" },
    { ...live, hostname: "192.168.1.10" },
    { ...live, search: "?review=1" },
    { ...live, pathname: "/other/" },
  ]) {
    assert.equal(productionVisitor(location, "phc_test"), false);
  }
  assert.equal(productionVisitor(live, ""), false);
});

test("redaction strips invite codes and campaign values, including nested SDK person properties", () => {
  const event = cleanEvent({
    properties: {
      $current_url:
        "https://yagyesh-bobde.github.io/pocket-tanks/?room=SECRET#private",
      $referrer: "https://example.com/path?email=private@example.com",
      $set_once: {
        $initial_current_url: "https://example.com/?room=SECRET",
        utm_campaign: "private",
      },
      $referring_domain: "example.com",
      mode: "local",
    },
  });
  assert.equal(
    event.properties.$current_url,
    "https://yagyesh-bobde.github.io/pocket-tanks/",
  );
  assert.equal(event.properties.$referrer, "https://example.com/path");
  assert.deepEqual(event.properties.$set_once, {
    $initial_current_url: "https://example.com/",
  });
  assert.equal(event.properties.$referring_domain, "example.com");
  assert.ok(!JSON.stringify(event).includes("SECRET"));
});

test("pageviews register game filters, queue real events, and reject private/unrecognized fields", async () => {
  const f = fixture(),
    analytics = createAnalytics(f.options);
  analytics.track("pt_match_started", {
    mode: "local",
    terrain: "mountain",
    name: "Private",
    room: "SECRET",
  });
  analytics.track("arbitrary_private_event", { name: "Private" });
  await analytics.ready;
  assert.deepEqual(f.config.registered, {
    app: "pocket-tanks",
    environment: "production",
  });
  assert.deepEqual(
    f.sent.map((e) => e.event),
    ["$pageview", "pt_match_started"],
  );
  assert.deepEqual(f.sent[1].properties, {
    mode: "local",
    terrain: "mountain",
  });
  assert.equal(f.sent[0].properties.visitor_type, "new");
  assert.equal(f.config.disable_session_recording, true);
  assert.equal(f.config.autocapture, false);
  assert.equal(f.config.person_profiles, "never");
  await createAnalytics(f.options).ready;
  assert.equal(f.sent[2].properties.visitor_type, "returning");
  analytics.optOut();
  analytics.track("pt_match_completed", { mode: "local" });
  assert.equal(f.sent.length, 3);
  assert.equal(f.config.optedOut, true);
  assert.equal(f.config.before_send({ properties: {} }), null);
  f.data.set("pt-analytics-optout", "0");
  await createAnalytics(f.options).ready;
  assert.equal(f.config.optedIn, true);
  assert.equal(f.sent.at(-1).event, "$pageview");
});

test("opt-out, DNT, and GPC prevent loading the SDK; opting out during loading cancels capture", async () => {
  for (const navigator of [
    { doNotTrack: "1" },
    { globalPrivacyControl: true },
  ]) {
    let loaded = false;
    const f = fixture({
      navigator,
      load: async () => {
        loaded = true;
      },
    });
    await createAnalytics(f.options).ready;
    assert.equal(loaded, false);
  }
  const f = fixture();
  f.data.set("pt-analytics-optout", "1");
  await createAnalytics(f.options).ready;
  assert.equal(f.sent.length, 0);
  f.data.clear();
  const analytics = createAnalytics(f.options);
  analytics.track("pt_mode_selected", { mode: "cpu" });
  analytics.optOut();
  await analytics.ready;
  assert.equal(f.sent.length, 0);
});

test("analytics loading and unavailable browser storage never interrupt the game", async () => {
  const f = fixture({
    storage: {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
    },
  });
  await createAnalytics(f.options).ready;
  assert.equal(f.sent[0].event, "$pageview");
  await createAnalytics(
    fixture({
      load: async () => {
        throw Error("offline");
      },
    }).options,
  ).ready;
});
