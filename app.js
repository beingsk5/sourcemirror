const WORKER_URL = "https://sourcemirror.takeiteasy4possible.workers.dev";

const btn = document.getElementById("startBtn");

const linksArea = document.getElementById("linksArea");
const jobNotes  = document.getElementById("jobNotes");

const jobBox    = document.getElementById("jobBox");
const jobIdEl   = document.getElementById("jobId");
const filesArea = document.getElementById("filesArea");
const jobStatus = document.getElementById("jobStatus");

let lastStageIndex = -1;
let currentJobId = null;
let currentRunId = null;
let pollingTimer = null;

/* =========================================================
   Start button
   ========================================================= */

btn.onclick = async () => {

  const links = collectLinksFromUI();

  if (!links.length) {
    alert("Please add at least one valid link");
    return;
  }

  const jobId = crypto.randomUUID();
  currentJobId = jobId;

  btn.disabled = true;
  btn.textContent = "Processing…";

  const r = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      links: links,
      notes: jobNotes.value || ""
    })
  });

  const data = await r.json().catch(() => null);

  if (!data || !data.ok || !data.run_id) {
    alert("Failed to start job");
    btn.disabled = false;
    btn.textContent = "Start mirroring";
    return;
  }

  currentRunId = data.run_id;

  jobBox.classList.remove("hidden");
  jobIdEl.textContent = jobId;
  jobStatus.textContent = "Queued";

  filesArea.innerHTML = "";

  links.forEach(l => {
    const name = fileNameFromUrl(l.url);
    filesArea.appendChild(renderFileCard(name));
  });

  lastStageIndex = -1;

  startPolling(currentRunId, currentJobId);
};


/* =========================================================
   Read links from UI
   ========================================================= */

function collectLinksFromUI() {

  const cards = linksArea.querySelectorAll("> div");
  const out = [];

  cards.forEach(card => {

    const url = card.querySelector(".urlInput")?.value.trim();
    if (!url) return;

    out.push({
      url: url,
      folder: card.querySelector(".folderInput")?.value.trim() || "",
      rename: card.querySelector(".renameInput")?.value.trim() || "",
      allow_ext: card.querySelector(".allowExtChk")?.checked || false,
      notes: card.querySelector(".notesInput")?.value.trim() || ""
    });
  });

  return out;
}


/* =========================================================
   Stage cards
   ========================================================= */

function renderFileCard(name) {

  const div = document.createElement("div");

  div.className = "border border-zinc-800 rounded-lg p-4";

  div.innerHTML = `
    <div class="font-medium mb-2">${escapeHtml(name)}</div>

    <div class="space-y-1 text-sm stage-ui">
      <div>● Validating</div>
      <div>○ Downloading</div>
      <div>○ Uploading to Mirror</div>
      <div>○ Verifying</div>
      <div>○ Finished</div>
    </div>
  `;

  return div;
}


/* =========================================================
   Polling
   ========================================================= */

function startPolling(runId, jobId) {

  if (pollingTimer) clearInterval(pollingTimer);

  pollingTimer = setInterval(async () => {

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

      clearInterval(pollingTimer);

      btn.disabled = false;
      btn.textContent = "Start mirroring";

      if (Array.isArray(data.files)) {
        renderResultFiles(data.files);
      }
    }

  }, 1000);
}


/* =========================================================
   Result + retry UI
   ========================================================= */

function renderResultFiles(files) {

  filesArea.innerHTML = "";

  files.forEach(f => {

    const row = document.createElement("div");
    row.className =
      "border border-zinc-800 rounded-lg p-3 text-sm flex items-center justify-between gap-3";

    const left = document.createElement("div");

    left.innerHTML = `
      <div class="font-medium">
        ${escapeHtml(f.final || f.original || "")}
      </div>
      <div class="text-xs ${
        f.status === "failed" ? "text-red-400" : "text-green-400"
      }">
        ${escapeHtml(f.status || "unknown")}
      </div>
    `;

    const right = document.createElement("div");

    if (f.status === "failed") {

      const btnRetry = document.createElement("button");
      btnRetry.textContent = "Retry";
      btnRetry.className =
        "px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs";

      btnRetry.onclick = async () => {

        btnRetry.disabled = true;
        btnRetry.textContent = "Retrying…";

        await triggerRetry([f.final || f.original]);

      };

      right.appendChild(btnRetry);
    }

    row.appendChild(left);
    row.appendChild(right);

    filesArea.appendChild(row);
  });
}


/* =========================================================
   Retry
   ========================================================= */

async function triggerRetry(fileList) {

  if (!currentJobId) return;

  const r = await fetch(WORKER_URL + "/retry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: currentJobId,
      files: fileList
    })
  });

  const data = await r.json().catch(() => null);

  if (!r.ok || !data || !data.ok) {
    alert("Retry failed to start");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Processing…";

  jobStatus.textContent = "retrying";

  lastStageIndex = -1;

  startPolling(currentRunId, currentJobId);
}


/* =========================================================
   Stage UI
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
    validating:  "#facc15",
    downloading: "#60a5fa",
    uploading:   "#c084fc",
    verifying:   "#fb923c",
    finished:    "#34d399"
  };

  const completedColor = "#34d399";
  const pendingColor   = "#a1a1aa";

  const incomingIndex = map[stage];
  if (incomingIndex === undefined) return;

  if (incomingIndex < lastStageIndex) return;

  lastStageIndex = incomingIndex;
  const index = incomingIndex;

  document.querySelectorAll("#filesArea > div").forEach(card => {

    const rows = card.querySelectorAll(".stage-ui > div");
    if (!rows.length) return;

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


/* =========================================================
   Helpers
   ========================================================= */

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
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  }[m]));
}
