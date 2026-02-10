const WORKER_URL = "https://sourcemirror.takeiteasy4possible.workers.dev";

const btn = document.getElementById("startBtn");

const linksArea = document.getElementById("linksArea");
const addLinkBtn = document.getElementById("addLinkBtn");
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
   Compression helpers
   ========================================================= */

function getCompressionState() {
  return {
    enabled: document.getElementById("compressEnable")?.checked || false,
    level:   document.getElementById("compressLevel")?.value || "mid",
    type:    document.getElementById("compressType")?.value || "zip"
  };
}

/* =========================================================
   Compression panel
   ========================================================= */

let compressionBox = document.getElementById("compressionBox");

if (!compressionBox) {

  compressionBox = document.createElement("div");
  compressionBox.id = "compressionBox";
  compressionBox.className =
    "mt-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg";

  compressionBox.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <div class="text-sm font-semibold">Archive & compression</div>
      <span class="text-xs text-zinc-500">Optional</span>
    </div>

    <div class="text-xs text-zinc-500 mb-4">
      Package files into a single archive before uploading to SourceForge.
    </div>

    <label class="flex items-center gap-2 text-sm text-zinc-300 mb-4">
      <input type="checkbox" id="compressEnable" class="accent-blue-500">
      Enable compression
    </label>

    <div class="grid grid-cols-2 gap-4 mb-3">

      <div>
        <label class="block text-xs text-zinc-400 mb-1">
          Compression profile
        </label>
        <select id="compressLevel"
          class="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800">
          <option value="store">Store – no compression (fastest)</option>
          <option value="low">Low – very fast</option>
          <option value="mid" selected>Balanced</option>
          <option value="high">High compression</option>
          <option value="ultra">Ultra – smallest size</option>
        </select>
      </div>

      <div>
        <label class="block text-xs text-zinc-400 mb-1">
          Archive format
        </label>
        <select id="compressType"
          class="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800">
          <option value="zip">ZIP (.zip)</option>
          <option value="7z">7-Zip (.7z)</option>
          <option value="tar.gz">TAR + GZip (.tar.gz)</option>
          <option value="tar.bz2">TAR + BZip2 (.tar.bz2)</option>
          <option value="tar.xz">TAR + XZ (.tar.xz)</option>
          <option value="gz">GZip (.gz)</option>
          <option value="bz2">BZip2 (.bz2)</option>
          <option value="xz">XZ (.xz)</option>
        </select>
      </div>

    </div>

    <div id="compressionNote"
      class="hidden text-xs leading-relaxed text-yellow-300
             border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
      When compression is enabled, only the generated archive is uploaded.
      Original files are not published individually.
      File renaming is supported, but manual extension changes are disabled
      because the selected archive format controls the final file extension.
    </div>
  `;
}

/* =========================================================
   Preview panel
   ========================================================= */

let previewBox = document.getElementById("previewBox");

if (!previewBox) {
  previewBox = document.createElement("div");
  previewBox.id = "previewBox";
  previewBox.className =
    "mt-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg";
}

/* =========================================================
   Mirror history panel
   ========================================================= */

let historyBox = document.getElementById("historyBox");

if (!historyBox) {

  historyBox = document.createElement("div");
  historyBox.id = "historyBox";
  historyBox.className =
    "mt-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg";

  historyBox.innerHTML = `
    <div class="font-semibold mb-1">Recent jobs</div>
    <div class="text-xs text-zinc-500 mb-3">
      Last completed and failed mirror tasks
    </div>
    <div id="historyList" class="space-y-2 text-sm text-zinc-300">
      Loading…
    </div>
  `;
}

/* =========================================================
   Place panels
   ========================================================= */

const container = linksArea.parentElement;

if (!compressionBox.parentElement)
  container.insertBefore(compressionBox, jobNotes.parentElement);

if (!previewBox.parentElement)
  container.insertBefore(previewBox, jobNotes.parentElement);

if (!historyBox.parentElement)
  container.appendChild(historyBox);

/* =========================================================
   Compression reactions
   ========================================================= */

["compressEnable","compressLevel","compressType"].forEach(id=>{
  compressionBox.querySelector("#"+id).addEventListener("change", ()=>{
    const note = document.getElementById("compressionNote");
    note.classList.toggle("hidden", !getCompressionState().enabled);
    renderLinksUI();
  });
});

/* =========================================================
   LINK MODEL
   ========================================================= */

let linkCards = [];

function addDefaultLink() {
  linkCards = [{
    url: "",
    folder: "",
    nameOnly: "",
    ext: "",
    allow_ext: false,
    notes: ""
  }];
  renderLinksUI();
}

function addNewLink() {
  linkCards.push({
    url: "",
    folder: "",
    nameOnly: "",
    ext: "",
    allow_ext: false,
    notes: ""
  });
  renderLinksUI();
}

if (addLinkBtn) addLinkBtn.onclick = addNewLink;

/* =========================================================
   Render links
   ========================================================= */

function renderLinksUI() {

  linksArea.innerHTML = "";

  const compression = getCompressionState();

  linkCards.forEach((item, index) => {

    const card = document.createElement("div");
    card.className =
      "border border-zinc-800 rounded-xl p-4 bg-zinc-950/40";

    const title = index === 0 ? "Link" : `Link ${index + 1}`;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-medium">${title}</div>
        ${index === 0 ? "" :
          `<button class="removeBtn text-xs text-red-400 hover:text-red-300">Remove</button>`
        }
      </div>

      <input
        class="urlInput w-full mb-3 p-2 rounded-lg bg-zinc-950 border border-zinc-800"
        placeholder="Direct file URL"
        value="${escapeHtml(item.url)}"
      >

      <details>
        <summary class="cursor-pointer text-xs text-zinc-400 select-none">
          Advanced options
        </summary>

        <div class="mt-3 space-y-3">

          <input
            class="folderInput w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800"
            placeholder="Target folder path"
            value="${escapeHtml(item.folder)}"
          >

          <div class="grid grid-cols-3 gap-2">
            <input
              class="nameOnlyInput col-span-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800"
              placeholder="Rename file (without extension)"
              value="${escapeHtml(item.nameOnly)}"
            >

            <input
              class="extInput p-2 rounded-lg bg-zinc-950 border border-zinc-800"
              placeholder="ext"
              value="${escapeHtml(item.ext)}"
              disabled
            >
          </div>

          <label class="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" class="allowExtChk accent-blue-500">
            Allow manual extension change
          </label>

          <textarea
            class="notesInput w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
            placeholder="Optional note for this file"
            rows="2"
          >${escapeHtml(item.notes)}</textarea>

        </div>
      </details>
    `;

    const urlInput = card.querySelector(".urlInput");
    const folderIn = card.querySelector(".folderInput");
    const nameIn   = card.querySelector(".nameOnlyInput");
    const extIn    = card.querySelector(".extInput");
    const allowChk = card.querySelector(".allowExtChk");
    const notesIn  = card.querySelector(".notesInput");

    if (compression.enabled) {
      allowChk.checked = false;
      allowChk.disabled = true;
      extIn.disabled = true;
      item.allow_ext = false;
    } else {
      allowChk.disabled = false;
      allowChk.checked = item.allow_ext;
      extIn.disabled = !item.allow_ext;
    }

    urlInput.oninput = e => { item.url = e.target.value; renderPreviewTree(); };
    folderIn.oninput = e => { item.folder = e.target.value; renderPreviewTree(); };
    nameIn.oninput   = e => { item.nameOnly = e.target.value; renderPreviewTree(); };
    extIn.oninput    = e => { item.ext = e.target.value; renderPreviewTree(); };

    allowChk.onchange = e => {
      item.allow_ext = e.target.checked;
      extIn.disabled = !e.target.checked;
      renderPreviewTree();
    };

    notesIn.oninput = e => item.notes = e.target.value;

    const rm = card.querySelector(".removeBtn");
    if (rm) {
      rm.onclick = () => {
        linkCards.splice(index, 1);
        if (!linkCards.length) addDefaultLink();
        else renderLinksUI();
      };
    }

    linksArea.appendChild(card);
  });

  renderPreviewTree();
}

addDefaultLink();

/* =========================================================
   Preview tree
   ========================================================= */

function renderPreviewTree() {

  const links = collectLinksFromUI();
  const compression = getCompressionState();

  const tree = {};
  const pathCount = {};
  const conflicts = [];

  for (const l of links) {

    const orig = fileNameFromUrl(l.url);

    let baseName;
    if (l.rename_base) baseName = l.rename_base;
    else {
      const dot = orig.lastIndexOf(".");
      baseName = dot !== -1 ? orig.slice(0, dot) : orig;
    }

    let finalName;

    if (compression.enabled) {
      finalName = baseName + "." + compression.type.replace(/^.*\./,"");
    } else {

      if (l.rename_base) {
        if (l.allow_ext && l.rename_ext)
          finalName = l.rename_base + "." + l.rename_ext;
        else {
          const dot = orig.lastIndexOf(".");
          const ext2 = dot !== -1 ? orig.slice(dot) : "";
          finalName = l.rename_base + ext2;
        }
      } else finalName = orig;
    }

    const folders = l.folder ? l.folder.split("/").filter(Boolean) : [];

    const fullPath =
      "SourceMirror/" +
      (folders.length ? folders.join("/") + "/" : "") +
      finalName;

    pathCount[fullPath] = (pathCount[fullPath] || 0) + 1;

    let node = tree;

    for (const f of folders) {
      node[f] = node[f] || {};
      node = node[f];
    }

    node[finalName] = null;
  }

  for (const p in pathCount)
    if (pathCount[p] > 1) conflicts.push(p);

  previewBox.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div class="text-sm font-semibold">Final output structure</div>
      <span class="text-xs text-zinc-500">Preview</span>
    </div>

    ${
      conflicts.length
      ? `<div class="mb-3 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
           <div class="font-medium mb-1">Conflicting file paths detected</div>
           <ul class="list-disc ml-5 space-y-1">
             ${conflicts.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
           </ul>
         </div>`
      : ""
    }

    ${renderTreeHTML(tree, pathCount, "")}
  `;
}

function renderTreeHTML(tree, pathCount, basePath) {

  function walk(obj, parentPath) {

    let html = "<ul class='ml-4 mt-1 space-y-1 text-xs'>";

    for (const k of Object.keys(obj).sort()) {

      const currentPath = parentPath ? parentPath + "/" + k : k;

      if (obj[k] === null) {

        const full = "SourceMirror/" + currentPath;
        const dup = pathCount[full] > 1;

        html += `<li class="flex items-center gap-2 ${dup ? "text-red-400" : "text-zinc-300"}">
          ${escapeHtml(k)} ${dup ? "⚠" : ""}
        </li>`;

      } else {

        html += `<li>
          <details open>
            <summary class="cursor-pointer flex items-center gap-2 text-zinc-200">
              ${escapeHtml(k)}
            </summary>
            ${walk(obj[k], currentPath)}
          </details>
        </li>`;
      }
    }

    html += "</ul>";
    return html;
  }

  return `
    <details open>
      <summary class="cursor-pointer flex items-center gap-2 text-zinc-200">
        SourceMirror
      </summary>
      ${walk(tree, basePath)}
    </details>
  `;
}

/* =========================================================
   Start job
   ========================================================= */

btn.onclick = async () => {

  const links = collectLinksFromUI();
  if (!links.length) {
    alert("Please add at least one valid file URL.");
    return;
  }

  const compression = getCompressionState();

  const jobId = crypto.randomUUID();
  currentJobId = jobId;

  const oldSummary = document.getElementById("summaryBox");
  if (oldSummary) oldSummary.remove();

  btn.disabled = true;
  btn.textContent = "Starting…";

  const r = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      links,
      notes: jobNotes.value || "",
      compression
    })
  });

  const data = await r.json().catch(() => null);

  if (!data || !data.ok || !data.run_id) {
    alert("Failed to start mirroring job.");
    btn.disabled = false;
    btn.textContent = "Mirror to SourceForge";
    return;
  }

  currentRunId = data.run_id;

  jobBox.classList.remove("hidden");
  jobIdEl.textContent = jobId;
  jobStatus.textContent = "Queued";

  filesArea.innerHTML = "";
  links.forEach(l =>
    filesArea.appendChild(renderFileCard(fileNameFromUrl(l.url)))
  );

  lastStageIndex = -1;
  startPolling(currentRunId, currentJobId);
};

/* =========================================================
   Collect links
   ========================================================= */

function collectLinksFromUI() {

  const out = [];

  linkCards.forEach(l => {

    if (!l.url.trim()) return;

    let rename = "";

    if (l.nameOnly) {
      if (l.allow_ext && l.ext) rename = l.nameOnly + "." + l.ext;
      else rename = l.nameOnly;
    }

    out.push({
      url: l.url.trim(),
      folder: l.folder.trim(),
      rename,
      allow_ext: l.allow_ext,
      notes: l.notes || "",
      rename_base: l.nameOnly || "",
      rename_ext: l.ext || ""
    });
  });

  return out;
}

/* =========================================================
   Job UI
   ========================================================= */

function renderFileCard(name) {

  const div = document.createElement("div");

  div.className =
    "border border-zinc-800 rounded-xl p-4 bg-zinc-950/40";

  div.innerHTML = `
    <div class="font-medium mb-2 text-sm">${escapeHtml(name)}</div>

    <div class="space-y-1 text-xs stage-ui">
      <div>● Validating</div>
      <div>○ Downloading</div>
      <div>○ Uploading to SourceMirror</div>
      <div>○ Verifying</div>
      <div>○ Finished</div>
    </div>
  `;

  return div;
}

function renderResultFiles(files) {

  filesArea.innerHTML = "";

  files.forEach(f => {

    const row = document.createElement("div");
    row.className =
      "border border-zinc-800 rounded-xl p-3 text-xs flex items-center justify-between gap-3 bg-zinc-950/40";

    row.innerHTML = `
      <div>
        <div class="font-medium">
          ${escapeHtml(f.final || f.original || "")}
        </div>
        <div class="${f.status === "failed" ? "text-red-400" : "text-emerald-400"}">
          ${escapeHtml(f.status || "")}
        </div>
      </div>
    `;

    filesArea.appendChild(row);
  });
}

/* =========================================================
   Summary UI
   ========================================================= */

function renderSummaryBox(summary) {

  if (!summary) return;

  let box = document.getElementById("summaryBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "summaryBox";
    box.className =
      "mt-4 border border-zinc-800 rounded-xl p-4 bg-zinc-950/40 text-xs text-zinc-300";
    filesArea.parentElement.insertBefore(box, filesArea);
  }

  const size =
    typeof summary.total_bytes === "number"
      ? formatBytes(summary.total_bytes)
      : "-";

  const time =
    typeof summary.time_taken_sec === "number"
      ? formatDuration(summary.time_taken_sec)
      : "-";

  box.innerHTML = `
    <div class="font-semibold text-sm mb-2">Job summary</div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <div class="text-zinc-400">Total files</div>
        <div>${escapeHtml(summary.total_files ?? "-")}</div>
      </div>

      <div>
        <div class="text-zinc-400">Total size</div>
        <div>${escapeHtml(size)}</div>
      </div>

      <div>
        <div class="text-zinc-400">Started</div>
        <div>${escapeHtml(formatTime(summary.started_at))}</div>
      </div>

      <div>
        <div class="text-zinc-400">Finished</div>
        <div>${escapeHtml(formatTime(summary.finished_at))}</div>
      </div>

      <div>
        <div class="text-zinc-400">Time taken</div>
        <div>${escapeHtml(time)}</div>
      </div>
    </div>
  `;
}

/* =========================================================
   Polling
   ========================================================= */

function startPolling(runId, jobId) {

  if (pollingTimer) clearInterval(pollingTimer);

  pollingTimer = setInterval(async () => {

    const r = await fetch(
      WORKER_URL + "/status?run_id=" + encodeURIComponent(runId) +
      "&job_id=" + encodeURIComponent(jobId),
      { cache: "no-store" }
    );

    if (!r.ok) return;

    const data = await r.json();

    jobStatus.textContent =
      data.status === "completed"
        ? (data.conclusion || "completed")
        : data.status;

    if (data.stage) updateStage(data.stage.toLowerCase().trim());

    if (data.status === "completed") {

      clearInterval(pollingTimer);
      btn.disabled = false;
      btn.textContent = "Mirror to SourceForge";

      if (Array.isArray(data.files))
        renderResultFiles(data.files);

      if (data.summary)
        renderSummaryBox(data.summary);

      loadHistory();
    }

  }, 1000);
}

/* =========================================================
   History  (shows file / folder instead of job id)
   ========================================================= */

async function loadHistory() {

  const list = document.getElementById("historyList");
  if (!list) return;

  list.textContent = "Loading…";

  let arr = null;

  try {
    const r = await fetch(WORKER_URL + "/history", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j)) arr = j;
    }
  } catch {}

  if (!arr) {
    try {
      const r2 = await fetch(
        "https://raw.githubusercontent.com/beingsk5/sourcemirror/progress/progress/history.json?ts=" +
          Date.now(),
        { cache: "no-store" }
      );
      if (r2.ok) {
        const j2 = await r2.json();
        if (Array.isArray(j2)) arr = j2;
      }
    } catch {}
  }

  if (!arr || !arr.length) {
    list.textContent = "No jobs yet.";
    return;
  }

  list.innerHTML = "";

  for (const h of arr.slice(0,10)) {

    let displayName = h.job_id || "";

    try {

      const rr = await fetch(
        "https://raw.githubusercontent.com/beingsk5/sourcemirror/progress/progress/result/" +
          encodeURIComponent(h.job_id) +
          ".json?ts=" + Date.now(),
        { cache: "no-store" }
      );

      if (rr.ok) {

        const data = await rr.json();

        if (Array.isArray(data?.files) && data.files.length) {

          const f = data.files[0];

          const folder = f.folder || "";
          const name   = f.final || f.original || "";

          if (folder && name)
            displayName = folder.replace(/\/+$/,"") + "/" + name;
          else if (name)
            displayName = name;
        }
      }

    } catch {}

    const statusText = String(h.status || "").toLowerCase();

    const isFail =
      statusText.includes("fail") ||
      statusText.includes("error");

    const badgeClass = isFail
      ? "bg-red-500/10 text-red-400 border border-red-500/30"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

    const badgeText = isFail ? "FAILED" : "COMPLETED";

    const row = document.createElement("div");
    row.className =
      "cursor-pointer p-2 rounded-lg hover:bg-zinc-800 transition flex items-center justify-between gap-2";

    row.innerHTML = `
      <div class="min-w-0">
        <div class="font-medium truncate">
          ${escapeHtml(displayName)}
        </div>
        <div class="text-xs text-zinc-400">
          ${escapeHtml(h.time || "")}
        </div>
      </div>

      <div class="px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">
        ${badgeText}
      </div>
    `;

    if (h.run_id) {
      row.onclick = () => openHistoryJob(h.job_id, h.run_id);
    }

    list.appendChild(row);
  }
}

async function openHistoryJob(jobId, runId) {

  const oldSummary = document.getElementById("summaryBox");
  if (oldSummary) oldSummary.remove();

  currentJobId = jobId;
  currentRunId = runId;

  jobBox.classList.remove("hidden");
  jobIdEl.textContent = jobId;

  lastStageIndex = -1;
  startPolling(runId, jobId);
}

/* =========================================================
   Stage UI
   ========================================================= */

function updateStage(stage) {

  const map = { validating:0, downloading:1, uploading:2, verifying:3, finished:4 };

  const activeColors = {
    validating:"#facc15",
    downloading:"#60a5fa",
    uploading:"#c084fc",
    verifying:"#fb923c",
    finished:"#34d399"
  };

  const completedColor = "#34d399";
  const pendingColor   = "#a1a1aa";

  const incomingIndex = map[stage];
  if (incomingIndex === undefined) return;
  if (incomingIndex < lastStageIndex) return;

  lastStageIndex = incomingIndex;

  document.querySelectorAll("#filesArea > div").forEach(card => {

    const rows = card.querySelectorAll(".stage-ui > div");

    rows.forEach((row, i) => {

      if (i < incomingIndex) {
        row.style.color = completedColor;
        row.textContent = row.textContent.replace(/^●|^○|^✔/, "✔");
      } else if (i === incomingIndex) {
        row.style.color = activeColors[stage] || "#60a5fa";
        row.textContent = row.textContent.replace(/^●|^○|^✔/, "●");
      } else {
        row.style.color = pendingColor;
        row.textContent = row.textContent.replace(/^●|^○|^✔/, "○");
      }
    });
  });
}

/* =========================================================
   Helpers
   ========================================================= */

function fileNameFromUrl(u) {
  try { return new URL(u).pathname.split("/").pop() || "file"; }
  catch { return "file"; }
}

function escapeHtml(s) {
  return String(s||"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}

function formatBytes(bytes) {
  if (typeof bytes !== "number") return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

function formatDuration(sec) {
  if (typeof sec !== "number") return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(t) {
  if (!t) return "-";
  try { return new Date(t).toLocaleString(); }
  catch { return "-"; }
}

/* =========================================================
   Load history on page open
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const note = document.getElementById("compressionNote");
  if (note) note.classList.toggle("hidden", !getCompressionState().enabled);
  loadHistory();
});
