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
   Preview panel (auto injected)
   ========================================================= */

let previewBox = document.getElementById("previewBox");

if (!previewBox) {
  previewBox = document.createElement("div");
  previewBox.id = "previewBox";
  previewBox.className =
    "mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4";

  linksArea.parentElement.appendChild(previewBox);
}

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

  linkCards.forEach((item, index) => {

    const card = document.createElement("div");
    card.className = "border border-zinc-800 rounded-lg p-4";

    const title = index === 0 ? "Link" : `Link ${index + 1}`;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="font-medium">${title}</div>
        ${
          index === 0
            ? ""
            : `<button class="removeBtn text-xs text-red-400 hover:underline">Remove</button>`
        }
      </div>

      <input
        class="urlInput w-full mb-2 p-2 rounded bg-zinc-900 border border-zinc-800"
        placeholder="File URL"
        value="${escapeHtml(item.url)}"
      >

      <details class="mt-2">
        <summary class="cursor-pointer text-sm text-zinc-400 select-none">
          ▸ Advanced
        </summary>

        <div class="mt-3 space-y-2">

          <input
            class="folderInput w-full p-2 rounded bg-zinc-900 border border-zinc-800"
            placeholder="Folder path (ex: Create Your Own Folder)"
            value="${escapeHtml(item.folder)}"
          >

          <div class="grid grid-cols-3 gap-2">
            <input
              class="nameOnlyInput col-span-2 p-2 rounded bg-zinc-900 border border-zinc-800"
              placeholder="File name (without extension)"
              value="${escapeHtml(item.nameOnly)}"
            >

            <input
              class="extInput p-2 rounded bg-zinc-900 border border-zinc-800"
              placeholder="ext (zip/exe/mp4/apk)"
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
            placeholder="Notes (optional)"
            rows="2"
          >${escapeHtml(item.notes)}</textarea>

        </div>
      </details>
    `;

    const urlInput   = card.querySelector(".urlInput");
    const folderIn   = card.querySelector(".folderInput");
    const nameIn     = card.querySelector(".nameOnlyInput");
    const extIn      = card.querySelector(".extInput");
    const allowChk   = card.querySelector(".allowExtChk");
    const notesIn    = card.querySelector(".notesInput");

    allowChk.checked = item.allow_ext;
    extIn.disabled   = !item.allow_ext;

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

        if (linkCards.length === 0) {
          addDefaultLink();
          return;
        }

        renderLinksUI();
      };
    }

    linksArea.appendChild(card);
  });

  renderPreviewTree();
}

addDefaultLink();

/* =========================================================
   Build preview tree + conflict detection
   ========================================================= */

function renderPreviewTree() {

  const links = collectLinksFromUI();

  const tree = {};
  const pathCount = {};
  const conflicts = [];

  for (const l of links) {

    const orig = fileNameFromUrl(l.url);

    let finalName = orig;

    if (l.rename_base) {
      if (l.allow_ext && l.rename_ext) {
        finalName = l.rename_base + "." + l.rename_ext;
      } else {
        const dot = orig.lastIndexOf(".");
        const ext = dot !== -1 ? orig.slice(dot) : "";
        finalName = l.rename_base + ext;
      }
    }

    const folders = l.folder
      ? l.folder.split("/").filter(Boolean)
      : [];

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

  for (const p in pathCount) {
    if (pathCount[p] > 1) conflicts.push(p);
  }

  let warnHtml = "";

  if (conflicts.length) {
    warnHtml = `
      <div class="mb-3 p-3 rounded border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
        <div class="font-medium mb-1">⚠ Conflicting files detected</div>
        <ul class="list-disc ml-5 space-y-1">
          ${conflicts.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
        </ul>
      </div>
    `;
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

        const full =
          "SourceMirror/" + currentPath;

        const dup = pathCount[full] > 1;

        html += `
          <li class="flex items-center gap-2 ${dup ? "text-red-400" : ""}">
            📄 ${escapeHtml(k)} ${dup ? "⚠" : ""}
          </li>
        `;

      } else {

        html += `
          <li>
            <details open>
              <summary class="cursor-pointer flex items-center gap-2">
                📁 ${escapeHtml(k)}
              </summary>
              ${walk(obj[k], currentPath)}
            </details>
          </li>
        `;
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
      links,
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
    filesArea.appendChild(renderFileCard(fileNameFromUrl(l.url)));
  });

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
      if (l.allow_ext && l.ext) {
        rename = l.nameOnly + "." + l.ext;
      } else {
        rename = l.nameOnly;
      }
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
      <div class="text-xs ${f.status === "failed" ? "text-red-400" : "text-green-400"}">
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

  document.querySelectorAll("#filesArea > div").forEach(card => {

    const rows = card.querySelectorAll(".stage-ui > div");
    if (!rows.length) return;

    rows.forEach((row, i) => {

      if (i < incomingIndex) {
        row.style.color = completedColor;
        row.textContent = row.textContent.replace(/^●|^○|^✔/, "✔");
        return;
      }

      if (i === incomingIndex) {
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
