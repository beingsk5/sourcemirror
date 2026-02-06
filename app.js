const WORKER_URL = "https://sourcemirror.takeiteasy4possible.workers.dev";

const btn = document.getElementById("startBtn");
const textarea = document.getElementById("urls");

const jobBox = document.getElementById("jobBox");
const jobIdEl = document.getElementById("jobId");
const filesArea = document.getElementById("filesArea");
const jobStatus = document.getElementById("jobStatus");

// ---- prevents going backwards when webhooks arrive out-of-order
let lastStageIndex = -1;

btn.onclick = async () => {

  const urls = textarea.value
    .split("\n")
    .map(v => v.trim())
    .filter(v => v.length);

  if (!urls.length) {
    alert("Please paste at least one URL");
    return;
  }

  const jobId = crypto.randomUUID();

  btn.disabled = true;
  btn.textContent = "Starting…";

  const r = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      urls: urls.join("\n")
    })
  });

  const data = await r.json();

  if (!data.ok || !data.run_id) {
    alert("Failed to start job");
    btn.disabled = false;
    btn.textContent = "Mirror to SourceForge";
    return;
  }

  const runId = data.run_id;

  jobBox.classList.remove("hidden");
  jobIdEl.textContent = jobId;
  jobStatus.textContent = "Queued";

  filesArea.innerHTML = "";

  for (const u of urls) {
    const name = fileNameFromUrl(u);
    filesArea.appendChild(renderFileCard(name));
  }

  btn.textContent = "Started";

  // reset monotonic stage guard for new job
  lastStageIndex = -1;

  startPolling(runId, jobId);
};

function renderFileCard(name) {

  const div = document.createElement("div");

  div.className = "border border-zinc-800 rounded-lg p-4";

  div.innerHTML = `
    <div class="font-medium mb-2">${escapeHtml(name)}</div>

    <div class="space-y-1 text-sm">
      <div>● Validating</div>
      <div>○ Downloading</div>
      <div>○ Uploading to Mirror</div>
      <div>○ Verifying</div>
      <div>○ Finished</div>
    </div>
  `;

  return div;
}

function fileNameFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const b = p.split("/").pop();
    return b || "file";
  } catch {
    return "file";
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}

/* =========================================================
   Polling logic
   ========================================================= */

async function startPolling(runId, jobId) {

  const timer = setInterval(async () => {

    const r = await fetch(
      WORKER_URL +
        "/status?run_id=" + encodeURIComponent(runId) +
        "&job_id=" + encodeURIComponent(jobId)
    );

    if (!r.ok) return;

    const data = await r.json();

    jobStatus.textContent =
      data.status === "completed"
        ? (data.conclusion || "completed")
        : data.status;

    if (data.stage) {
      updateStage(data.stage.toLowerCase().trim());
    }

    if (data.status === "completed") {
      clearInterval(timer);
    }

  }, 1000);
}

/* =========================================================
   Per-stage colored + skip-safe + monotonic updater
   ========================================================= */

function updateStage(stage) {

  const map = {
    validating: 0,
    downloading: 1,
    uploading: 2,
    verifying: 3,
    finished: 4
  };

  const activeColors = {
    validating:  "#facc15", // yellow
    downloading: "#60a5fa", // blue
    uploading:   "#c084fc", // purple
    verifying:   "#fb923c", // orange
    finished:    "#34d399"  // green
  };

  const completedColor = "#34d399"; // green
  const pendingColor   = "#a1a1aa"; // gray

  const incomingIndex = map[stage];
  if (incomingIndex === undefined) return;

  // ---- do not allow going backwards
  if (incomingIndex < lastStageIndex) {
    return;
  }

  lastStageIndex = incomingIndex;
  const index = incomingIndex;

  document.querySelectorAll("#filesArea > div").forEach(card => {

    const rows = card.querySelectorAll(".space-y-1 > div");

    rows.forEach((row, i) => {

      if (i < index) {
        row.style.color = completedColor;
        row.textContent = row.textContent.replace(/^●|^○|^✔/, "✔");
        return;
      }

      if (i === index) {
        row.style.color = activeColors[stage] || "#60a5fa";
        row.textContent = row.textContent.replace(/^●|^○|^✔/, "●");
        return;
      }

      row.style.color = pendingColor;
      row.textContent = row.textContent.replace(/^●|^○|^✔/, "○");

    });

  });
}
