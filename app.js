const WORKER_URL = "https://sourcemirror.takeiteasy4possible.workers.dev";

const btn = document.getElementById("startBtn");
const textarea = document.getElementById("urls");

const jobBox = document.getElementById("jobBox");
const jobIdEl = document.getElementById("jobId");
const filesArea = document.getElementById("filesArea");
const jobStatus = document.getElementById("jobStatus");

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

  const r = await fetch(WORKER_URL + "/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      urls: urls              // ✅ IMPORTANT: array, not joined string
    })
  });

  const data = await r.json();

  if (!data.ok) {
    alert("Failed to start job");
    btn.disabled = false;
    btn.textContent = "Mirror to SourceForge";
    return;
  }

  // ✅ store run_id and start polling
  const runId = data.run_id;
  startPolling(runId);

  jobBox.classList.remove("hidden");
  jobIdEl.textContent = jobId;
  jobStatus.textContent = "queued";

  filesArea.innerHTML = "";

  for (const u of urls) {
    const name = fileNameFromUrl(u);
    filesArea.appendChild(renderFileCard(name));
  }

  btn.textContent = "Started";
};

function renderFileCard(name) {

  const div = document.createElement("div");

  div.className =
    "border border-zinc-800 rounded-lg p-4";

  div.innerHTML = `
    <div class="font-medium mb-2">${escapeHtml(name)}</div>

    <div class="space-y-1 text-sm">
      <div class="text-blue-400">● Validating</div>
      <div class="text-zinc-500">○ Downloading</div>
      <div class="text-zinc-500">○ Uploading to SourceForge</div>
      <div class="text-zinc-500">○ Verifying</div>
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

/* ---------------------------------------------------
   🔁 Status polling
--------------------------------------------------- */

async function startPolling(runId) {

  const timer = setInterval(async () => {

    try {

      const r = await fetch(
        WORKER_URL + "/status?run_id=" + encodeURIComponent(runId)
      );

      if (!r.ok) return;

      const data = await r.json();

      jobStatus.textContent =
        data.status === "completed"
          ? (data.conclusion || "completed")
          : data.status;

      if (data.stage) {
        updateStage(data.stage);
      }

      if (data.status === "completed") {
        clearInterval(timer);
      }

    } catch (e) {
      // ignore temporary network errors
    }

  }, 5000);
}

function updateStage(stage) {

  const map = {
    validating: 0,
    downloading: 1,
    uploading: 2,
    verifying: 3
  };

  const index = map[stage];
  if (index === undefined) return;

  document.querySelectorAll("#filesArea > div").forEach(card => {

    const rows = card.querySelectorAll(".space-y-1 > div");

    rows.forEach((r, i) => {

      if (i < index) {
        r.className = "text-green-400";
        r.textContent = r.textContent.replace("○", "✔").replace("●", "✔");
      } else if (i === index) {
        r.className = "text-blue-400";
        r.textContent = r.textContent.replace("○", "●").replace("✔","●");
      } else {
        r.className = "text-zinc-500";
      }

    });

  });
}
