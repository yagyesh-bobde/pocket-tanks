// Analytics never shares player names, invite codes, saved matches, or input values.
export function productionVisitor(location, key) {
  return (
    !!key &&
    location.hostname === "yagyesh-bobde.github.io" &&
    /^\/pocket-tanks\/$/.test(location.pathname) &&
    !new URLSearchParams(location.search).has("review")
  );
}

const events = {
  pt_mode_selected: ["mode"],
  pt_screen_view: ["screen", "mode"],
  pt_match_started: ["mode", "terrain", "wind", "difficulty"],
  pt_match_resumed: ["mode"],
  pt_match_completed: ["mode", "shots", "score_1", "score_2"],
  pt_room_connected: ["role"],
};

export function cleanEvent(event) {
  if (!event) return null;
  // Query strings and hashes can contain private room invitations.
  const clean = (props) => {
    if (!props || typeof props !== "object") return;
    for (const key of Object.keys(props)) {
      if (/url|referrer/i.test(key) && typeof props[key] === "string") {
        try {
          const url = new URL(props[key]);
          props[key] = url.origin + url.pathname;
        } catch {
          delete props[key];
        }
      }
      if (/search_keyword|utm_|gclid|fbclid|msclkid/i.test(key))
        delete props[key];
      else if (typeof props[key] === "object") clean(props[key]);
    }
  };
  clean(event.properties);
  return event;
}

export function createAnalytics({
  env = import.meta.env ?? {},
  location = globalThis.location,
  navigator = globalThis.navigator,
  storage,
  load = () => import("posthog-js"),
} = {}) {
  let sdk,
    stopped = false,
    queue = [];
  if (!storage) {
    try {
      storage = globalThis.localStorage;
    } catch {}
  }
  const get = (key) => {
    try {
      return storage?.getItem(key);
    } catch {
      return null;
    }
  };
  const set = (key, value) => {
    try {
      storage?.setItem(key, value);
    } catch {}
  };
  const disabled = () =>
    stopped ||
    get("pt-analytics-optout") === "1" ||
    navigator?.doNotTrack === "1" ||
    navigator?.globalPrivacyControl === true;
  const enabled =
    productionVisitor(location, env.VITE_POSTHOG_KEY) && !disabled();
  const track = (event, properties = {}) => {
    if (!enabled || disabled() || !events[event]) return;
    const safe = Object.fromEntries(
      events[event]
        .filter((key) =>
          ["string", "number", "boolean"].includes(typeof properties[key]),
        )
        .map((key) => [key, properties[key]]),
    );
    try {
      if (sdk) sdk.capture(event, safe);
      else if (queue.length < 20) queue.push([event, safe]);
    } catch {
      /* An unavailable analytics service must never affect play. */
    }
  };
  const ready = enabled
    ? Promise.resolve()
        .then(load)
        .then(({ default: posthog }) => {
          if (disabled()) return;
          posthog.init(env.VITE_POSTHOG_KEY, {
            api_host: env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
            ui_host: "https://us.posthog.com",
            persistence: "localStorage",
            person_profiles: "never",
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: true,
            capture_performance: false,
            capture_exceptions: false,
            capture_heatmaps: false,
            disable_session_recording: true,
            disable_surveys: true,
            disable_external_dependency_loading: true,
            advanced_disable_flags: true,
            respect_dnt: true,
            store_google: false,
            save_campaign_params: false,
            before_send: (event) => (disabled() ? null : cleanEvent(event)),
            loaded(client) {
              if (disabled()) {
                client.opt_out_capturing();
                return;
              }
              if (get("pt-analytics-optout") === "0")
                client.opt_in_capturing({ captureEventName: false });
              sdk = client;
              client.register({
                app: "pocket-tanks",
                environment: "production",
              });
              const visitorType = get("pt-visited") ? "returning" : "new";
              client.capture("$pageview", { visitor_type: visitorType });
              set("pt-visited", "1");
              for (const [event, props] of queue) client.capture(event, props);
              queue = [];
            },
          });
        })
        .catch(() => {
          queue = [];
        })
    : Promise.resolve();
  return {
    track,
    ready,
    enabled,
    optOut() {
      stopped = true;
      queue = [];
      set("pt-analytics-optout", "1");
      try {
        sdk?.opt_out_capturing();
      } catch {}
    },
  };
}
