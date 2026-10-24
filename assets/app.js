// status.logfolio.co: reads what Upptime (this repo's workflows) saves
// every 5 minutes and draws it. Nothing runs on our server, so the page
// works when logfolio.co is down.
const REPO = "logfolio-co/status";
const RAW = `https://raw.githubusercontent.com/${REPO}/master`;
const DAYS = 90;
// Phones show the last 30 days, so the bars stay wide enough to read.
const PHONE_DAYS = 30;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const day = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "just now" : min === 1 ? "1 minute ago" : min < 60 ? `${min} minutes ago` : `${Math.round(min / 60)} hours ago`;
};

const LABEL = { up: "Up", degraded: "Slow", down: "Down" };
const DOT = { up: "bg-up", degraded: "bg-slow", down: "bg-down" };

// A history/<slug>.yml field (flat "key: value" lines).
const field = (yml, key) => yml.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1]?.trim() ?? null;

// One bar per day: grey before checks began, then by minutes down.
function bars(site, start) {
  const down = site.dailyMinutesDown ?? {};
  const out = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const before = start && key < start.slice(0, 10);
    const min = down[key] ?? 0;
    const cls = before ? "bg-muted" : min === 0 ? "bg-foreground/80" : min < 60 ? "bg-slow" : "bg-down";
    const label = before ? "No data yet" : min === 0 ? "No downtime" : `${min} ${min === 1 ? "minute" : "minutes"} down`;
    out.push(`<span class="h-7 flex-1 rounded-[2px] ${cls} ${i >= PHONE_DAYS ? "max-sm:hidden" : ""}" title="${day(d)} · ${label}"></span>`);
  }
  return out.join("");
}

function siteRow(site, start) {
  const status = site.status in LABEL ? site.status : "up";
  return `<li class="flex flex-col gap-3 px-5 py-4">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href="${esc(site.url)}" class="font-medium hover:underline hover:underline-offset-4">${esc(site.name)}</a>
      <span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
        <span class="size-1.5 rounded-full ${DOT[status]}" aria-hidden="true"></span>${LABEL[status]}
      </span>
      <span class="ml-auto text-sm text-muted-foreground tabular-nums">${esc(site.uptimeMonth ?? site.uptime)} uptime · ${Number(site.timeWeek ?? site.time).toLocaleString()} ms</span>
    </div>
    <div class="flex gap-[2px]" role="img" aria-label="${esc(site.name)}: last ${DAYS} days">${bars(site, start)}</div>
    <div class="flex justify-between text-xs text-muted-foreground"><span><span class="sm:hidden">${PHONE_DAYS}</span><span class="max-sm:hidden">${DAYS}</span> days ago</span><span>Today</span></div>
  </li>`;
}

function overall(sites) {
  const down = sites.filter((s) => s.status === "down");
  const slow = sites.filter((s) => s.status === "degraded");
  const [dot, text] = down.length
    ? ["bg-down", `${down.map((s) => s.name).join(", ")} ${down.length === 1 ? "is" : "are"} down`]
    : slow.length
      ? ["bg-slow", `${slow.map((s) => s.name).join(", ")} ${slow.length === 1 ? "is" : "are"} slow`]
      : ["bg-up", "All systems operational"];
  $("overall").innerHTML = `<span class="relative flex size-2.5 shrink-0" aria-hidden="true"><span class="absolute inline-flex size-full animate-ping rounded-full ${dot} opacity-40"></span><span class="relative inline-flex size-2.5 rounded-full ${dot}"></span></span><span class="font-medium">${esc(text)}</span>`;
}

async function load() {
  try {
    const sites = await (await fetch(`${RAW}/history/summary.json`, { cache: "no-store" })).json();
    // Each site's file says when checks began and when it was last checked.
    const ymls = await Promise.all(sites.map((s) => fetch(`${RAW}/history/${s.slug}.yml`, { cache: "no-store" }).then((r) => (r.ok ? r.text() : ""))));
    const starts = ymls.map((y) => field(y, "startTime"));
    // A site's file only changes when its status does, so "last check" is
    // the newest finished check run (Uptime CI); the file's time is the
    // fallback, labelled as the last change.
    const changedAt = ymls.map((y) => field(y, "lastUpdated")).filter(Boolean).sort().at(-1);
    overall(sites);
    $("sites").innerHTML = sites.map((s, i) => siteRow(s, starts[i])).join("");
    $("updated").textContent = changedAt ? `Last change ${ago(changedAt)}` : "";
    fetch(`https://api.github.com/repos/${REPO}/actions/workflows/uptime.yml/runs?per_page=1&status=success`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const at = d?.workflow_runs?.[0]?.updated_at;
        if (at) {
          $("updated").textContent = `Last check ${ago(at)}`;
        }
      })
      .catch(() => {});
  } catch {
    $("overall").innerHTML = `<span class="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true"></span><span class="font-medium">Couldn't load the latest checks.</span>`;
    $("sites").innerHTML = `<li class="px-5 py-4 text-sm text-muted-foreground">See them on <a class="underline underline-offset-4" href="https://github.com/${REPO}">GitHub</a>.</li>`;
  }
  try {
    // Upptime opens an issue (label "status") while a site is down.
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&labels=status&per_page=10`);
    // GitHub limits visitors' requests; past that, point at the list instead.
    if (!res.ok) {
      throw new Error(`GitHub answered ${res.status}`);
    }
    const issues = await res.json();
    $("incident-list").innerHTML = Array.isArray(issues) && issues.length
      ? issues
          .map((i) => `<li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 text-sm">
              <a href="${esc(i.html_url)}" class="font-medium hover:underline hover:underline-offset-4">${esc(i.title)}</a>
              <span class="text-muted-foreground">${day(new Date(i.created_at))}${i.state === "open" ? " · ongoing" : ""}</span>
            </li>`)
          .join("")
      : `<li class="px-5 py-4 text-sm text-muted-foreground">No incidents so far.</li>`;
  } catch {
    $("incident-list").innerHTML = `<li class="px-5 py-4 text-sm text-muted-foreground">Incidents are listed on <a class="underline underline-offset-4" href="https://github.com/${REPO}/issues">GitHub</a>.</li>`;
  }
}

load();
setInterval(load, 5 * 60 * 1000);
