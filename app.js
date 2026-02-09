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
    "mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4";

  compressionBox.innerHTML = `
    <div class="font-medium mb-2">Compression (optional)</div>

    <label class="flex items-center gap-2 text-sm text-zinc-300 mb-3">
      <input type="checkbox" id="compressEnable">
      Compress files before uploading to SourceForge
    </label>

    <div class="grid grid-cols-2 gap-3 mb-3">

      <div>
        <label class="block text-xs text-zinc-400 mb-1">
          Compression level
        </label>
        <select id="compressLevel"
          class="w-full p-2 rounded bg-zinc-900 border border-zinc-800">
          <option value="store">Store (no compression, fastest)</option>
          <option value="low">Low (very fast)</option>
          <option value="mid" selected>Balanced</option>
          <option value="high">High compression</option>
          <option value="ultra">Ultra (slowest, smallest size)</option>
        </select>
      </div>

      <div>
        <label class="block text-xs text-zinc-400 mb-1">
          Archive format
        </label>
        <select id="compressType"
          class="w-full p-2 rounded bg-zinc-900 border border-zinc-800">
          <option value="zip">ZIP (.zip)</option>
          <option value="7z">7-Zip (.7z)</option>
          <option value="tar.gz">TAR + GZip (.tar.gz)</option>
          <option value="tar.bz2">TAR + BZip2 (.tar.bz2)</option>
          <option value="tar.xz">TAR + XZ (.tar.xz)</option>
          <option value="gz">GZip single file (.gz)</option>
          <option value="bz2">BZip2 single file (.bz2)</option>
          <option value="xz">XZ single file (.xz)</option>
        </select>
      </div>

    </div>

    <div id="compressionNote"
      class="hidden text-sm text-yellow-300 border border-yellow-500/30 bg-yellow-500/10 rounded p-3">
      When compression is enabled, only the generated archive will be uploaded.
      Original files will not be uploaded separately.
      File renaming is supported, but manual extension changes are disabled
      because the selected archive format determines the final file extension.
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
    "mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4";
}

/* =========================================================
   Mirror history panel
   ========================================================= */

let historyBox = document.getElementById("historyBox");

if (!historyBox) {

  historyBox = document.createElement("div");
  historyBox.id = "historyBox";
  historyBox.className =
    "mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4";

  historyBox.innerHTML = `
    <div class="font-medium mb-2">Recent mirror history</div>
    <div id="historyList" class="space-y-2 text-sm text-zinc-300">
      Loading…
    </div>
  `;
}

/* =========================================================
   Place panels in required order
   ========================================================= */

const container = linksArea.parentElement;

if (!compressionBox.parentElement) {
  container.insertBefore(compressionBox, jobNotes.parentElement);
}

if (!previewBox.parentElement) {
  container.insertBefore(previewBox, jobNotes.parentElement);
}

if (!historyBox.parentElement) {
  container.insertBefore(historyBox, jobNotes.parentElement);
}

/* =========================================================
   Compression change reactions
   ========================================================= */

["compressEnable","compressLevel","compressType"].forEach(id=>{
  compressionBox.querySelector("#"+id).addEventListener("change", ()=>{
    const note = document.getElementById("compressionNote");
    note.classList.toggle("hidden", !getCompressionState().enabled);
    renderLinksUI();
  });
});

/* =========================================================
   LINK UI MODEL
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
   Render link cards
   ========================================================= */

function renderLinksUI() {

  linksArea.innerHTML = "";

  const compression = getCompressionState();

  linkCards.forEach((item, index) => {

    const card = document.createElement("div");
    card.className = "border border-zinc-800 rounded-lg p-4";

    const title = index === 0 ? "Link" : `Link ${index + 1}`;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="font-medium">${title}</div>
        ${index === 0 ? "" : `<button class="removeBtn text-xs text-red-400 hover:underline">Remove</button>`}
      </div>

      <input
        class="urlInput w-full mb-2 p-2 rounded bg-zinc-900 border border-zinc-800"
        placeholder="Direct file URL (example: https://example.com/file.zip)"
        value="${escapeHtml(item.url)}"
      >

      <details class="mt-2">
        <summary class="cursor-pointer text-sm text-zinc-400 select-none">
          ▸ Advanced
        </summary>

        <div class="mt-3 space-y-2">

          <input
            class="folderInput w-full p-2 rounded bg-zinc-900 border border-zinc-800"
            placeholder="Target folder path (example: android/roms/14)"
            value="${escapeHtml(item.folder)}"
          >

          <div class="grid grid-cols-3 gap-2">
            <input
              class="nameOnlyInput col-span-2 p-2 rounded bg-zinc-900 border border-zinc-800"
              placeholder="New file name (without extension)"
              value="${escapeHtml(item.nameOnly)}"
            >

            <input
              class="extInput p-2 rounded bg-zinc-900 border border-zinc-800"
              placeholder="ext"
              value="${escapeHtml(item.ext)}"
              disabled
            >
          </div>

          <label class="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" class="allowExtChk">
            Allow extension change
          </label>

          <textarea
            class="notesInput w-full p-2 rounded bg-zinc-900 border border-zinc-800 text-sm"
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
   Preview tree + conflict detection
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

    if (l.rename_base) {
      baseName = l.rename_base;
    } else {
      const dot = orig.lastIndexOf(".");
      baseName = dot !== -1 ? orig.slice(0, dot) : orig;
    }

    let finalName;

    if (compression.enabled) {

      const ext = compression.type;
      finalName = baseName + "." + ext.replace(/^.*\./,"");

    } else {

      if (l.rename_base) {
        if (l.allow_ext && l.rename_ext)
          finalName = l.rename_base + "." + l.rename_ext;
        else {
          const dot = orig.lastIndexOf(".");
          const ext2 = dot !== -1 ? orig.slice(dot) : "";
          finalName = l.rename_base + ext2;
        }
      } else {
        finalName = orig;
      }

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

  let warnHtml = "";

  if (conflicts.length) {
    warnHtml = `
      <div class="mb-3 p-3 rounded border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
        <div class="font-medium mb-1">⚠ Conflicting files detected</div>
        <ul class="list-disc ml-5 space-y-1">
          ${conflicts.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
        </ul>
      </div>`;
  }

  previewBox.innerHTML = `
    <div class="font-medium mb-2">Final folder preview</div>
    ${warnHtml}
    ${renderTreeHTML(tree, pathCount, "")}
  `;
}

function renderTreeHTML(tree, pathCount, basePath) {

  function walk(obj, parentPath) {

    let html = "<ul class='ml-4 mt-1 space-y-1 text-sm'>";

    for (const k of Object.keys(obj).sort()) {

      const currentPath = parentPath ? parentPath + "/" + k : k;

      if (obj[k] === null) {

        const full = "SourceMirror/" + currentPath;
        const dup = pathCount[full] > 1;

        html += `<li class="flex items-center gap-2 ${dup ? "text-red-400" : ""}">
          📄 ${escapeHtml(k)} ${dup ? "⚠" : ""}
        </li>`;

      } else {

        html += `<li>
          <details open>
            <summary class="cursor-pointer flex items-center gap-2">
              📁 ${escapeHtml(k)}
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
      <summary class="cursor-pointer flex items-center gap-2">
        📁 SourceMirror
      </summary>
      ${walk(tree, basePath)}
    </details>
  `;
}

/* =========================================================
   Start
   ========================================================= */

btn.onclick = async () => {

  const links = collectLinksFromUI();

  if (!links.length) {
    alert("Please add at least one valid link");
    return;
  }

  const compression = getCompressionState();

  const jobId = crypto.randomUUID();
  currentJobId = jobId;

  btn.disabled = true;
  btn.textContent = "Processing…";

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
   Polling + results
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

function startPolling(runId, jobId) {

  if (pollingTimer) clearInterval(pollingTimer);

  pollingTimer = setInterval(async () => {

    const r = await fetch(
      WORKER_URL + "/status?run_id=" + encodeURIComponent(runId) +
      "&job_id=" + encodeURIComponent(jobId)
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
      btn.textContent = "Start mirroring";

      if (Array.isArray(data.files)) renderResultFiles(data.files);

      loadHistory();
    }

  }, 1000);
}

/* =========================================================
   History loader
   ========================================================= */

async function loadHistory() {

  const list = document.getElementById("historyList");

  try {

    const r = await fetch(WORKER_URL + "/history");
    if (!r.ok) throw 0;

    const arr = await r.json();

    list.innerHTML = "";

    arr.slice(0,10).forEach(h => {

      const row = document.createElement("div");
      row.className =
        "cursor-pointer p-2 rounded hover:bg-zinc-800";

      row.innerHTML = `
        <div class="font-medium">${escapeHtml(h.job_id)}</div>
        <div class="text-xs text-zinc-400">
          ${escapeHtml(h.status)} – ${h.time}
        </div>
      `;

      row.onclick = () => openHistoryJob(h.job_id, h.run_id);

      list.appendChild(row);
    });

  } catch {
    list.textContent = "History not available yet";
  }
}

async function openHistoryJob(jobId, runId) {

  currentJobId = jobId;
  currentRunId = runId;

  jobBox.classList.remove("hidden");
  jobIdEl.textContent = jobId;

  lastStageIndex = -1;
  startPolling(runId, jobId);
}

/* =========================================================
   Helpers
   ========================================================= */

function updateStage(stage) {

  const map = { validating:0, downloading:1, uploading:2, verifying:3, finished:4 };

  const activeColors = {
    validating:"#facc15", downloading:"#60a5fa",
    uploading:"#c084fc", verifying:"#fb923c", finished:"#34d399"
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

function fileNameFromUrl(u) {
  try { return new URL(u).pathname.split("/").pop() || "file"; }
  catch { return "file"; }
}

function escapeHtml(s) {
  return String(s||"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}
