(() => {
  // Keep in step with the cards in lesson.html. Order is the study order.
  const modules = [
    { file: "lessonModuleOne.html", title: "Animal Cell vs Plant Cell", quiz: "quiz-animal-plant.html" },
    { file: "Lessonmodulemitosis.html", title: "Mitosis of Plant and Animal Cells", quiz: "quiz-mitosis.html" },
    { file: "lesson-cell-membrane.html", title: "Cell Membrane and Transport", quiz: "quiz-membrane.html" },
    { file: "lesson-cell-differentiation.html", title: "Cell Differentiation and Specialization", quiz: null },
    { file: "lesson-photosynthesis.html", title: "Photosynthesis", quiz: "quiz-photosynthesis.html" }
  ];

  // A section counts as read after it has stayed in the middle of the screen this long.
  const DWELL_MS = 2500;
  const WORDS_PER_MINUTE = 200;
  const SAVE_DELAY_MS = 1200;
  const STORAGE_VERSION = "v2";

  const currentFile = window.location.pathname.split("/").pop() || "lesson.html";
  const moduleIndex = modules.findIndex((item) => item.file.toLowerCase() === currentFile.toLowerCase());
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const icon = (name) => {
    const element = createElement("i", `bi bi-${name}`);
    element.setAttribute("aria-hidden", "true");
    return element;
  };

  const slugify = (text) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

  /* ---------------------------------------------------------------
     Progress storage
     Every student's progress is kept in two places:
       • this browser (localStorage), so it works instantly and offline
       • their account (Supabase table lesson_progress), so it follows
         them to another device
     Reading progress only ever grows, so the two are merged with a union.
     If the account table is missing or the student is signed out, the
     lesson still works from the browser copy.
  --------------------------------------------------------------- */

  const client = window.ecoAuth && window.ecoAuth.client;
  let remoteWarned = false;

  const emptyState = () => ({ read: [], total: 0, done: 0, completedAt: null });

  const localKey = (userId, file) =>
    `ecolearn-lesson-progress:${STORAGE_VERSION}:${userId || "guest"}:${file.toLowerCase()}`;

  const readLocal = (userId, file) => {
    try {
      const saved = JSON.parse(localStorage.getItem(localKey(userId, file)) || "null");
      if (!saved || !Array.isArray(saved.read)) return emptyState();
      return {
        read: saved.read.filter((key) => typeof key === "string"),
        total: Number(saved.total) || 0,
        done: Number(saved.done) || 0,
        completedAt: saved.completedAt || null
      };
    } catch (error) {
      return emptyState();
    }
  };

  const writeLocal = (userId, file, state) => {
    try { localStorage.setItem(localKey(userId, file), JSON.stringify(state)); } catch (error) { /* storage blocked */ }
  };

  const getUserId = async () => {
    if (!client) return null;
    try {
      const result = await Promise.race([
        client.auth.getSession(),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 1500))
      ]);
      return result?.data?.session?.user?.id || null;
    } catch (error) {
      return null;
    }
  };

  const warnRemote = (error) => {
    if (remoteWarned) return;
    remoteWarned = true;
    console.warn("Lesson progress is saved on this device only. Run supabase-lesson-progress.sql to save it to the account.", error);
  };

  const fetchRemote = async (userId, file) => {
    if (!client || !userId) return { row: null, ok: false };
    const { data, error } = await client
      .from("lesson_progress")
      .select("sections_read, sections_done, total_sections, completed_at")
      .eq("user_id", userId)
      .eq("lesson_key", file.toLowerCase())
      .maybeSingle();
    if (error) { warnRemote(error); return { row: null, ok: false }; }
    return { row: data, ok: true };
  };

  const fetchAllRemote = async (userId) => {
    if (!client || !userId) return { rows: [], ok: false };
    const { data, error } = await client
      .from("lesson_progress")
      .select("lesson_key, sections_read, sections_done, total_sections, completed_at")
      .eq("user_id", userId);
    if (error) { warnRemote(error); return { rows: [], ok: false }; }
    return { rows: data || [], ok: true };
  };

  const saveRemote = async (userId, file, state) => {
    if (!client || !userId) return false;
    const payload = {
      user_id: userId,
      lesson_key: file.toLowerCase(),
      sections_read: Array.isArray(state.read) ? state.read : [],
      sections_done: Number(state.done) || 0,
      total_sections: Number(state.total) || 0,
      completed_at: state.completedAt || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("lesson_progress").upsert(payload, { onConflict: "user_id,lesson_key" });
    if (error) { warnRemote(error); return false; }
    return true;
  };

  // Used to hide a Previous / Next / Quiz link when its page has not been published.
  // If the check itself fails (offline, file://), the link is kept.
  const existenceCache = {};
  const pageExists = (file) => {
    if (!existenceCache[file]) {
      existenceCache[file] = fetch(file, { method: "HEAD" })
        .then((response) => response.ok || response.status === 405)
        .catch(() => true);
    }
    return existenceCache[file];
  };

  /* ---------------------------------------------------------------
     Lesson catalog (lesson.html)
  --------------------------------------------------------------- */
  async function enhanceCatalog() {
    const list = document.querySelector(".lessons-list");
    const header = document.querySelector(".lessons-header");
    if (!list || !header) return;

    const cards = [...list.querySelectorAll(".lesson-card")];
    const userId = await getUserId();

    const items = cards.map((card) => {
      const button = card.querySelector(".card-btn");
      if (!button || button.classList.contains("is-disabled")) return null;
      const file = (button.getAttribute("href") || "").split("/").pop();
      const title = card.querySelector(".card-title")?.textContent.trim() || "lesson";

      const wrapper = createElement("div", "card-progress");
      const label = createElement("p", "card-progress-label");
      const track = createElement("div", "card-progress-track");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", "Lesson progress");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      const fill = createElement("span", "card-progress-fill");
      track.append(fill);
      wrapper.append(label, track);
      button.before(wrapper);

      return { card, button, file, title, wrapper, label, track, fill };
    }).filter(Boolean);

    const results = createElement("p", "lesson-results");
    let completedCount = 0;
    let query = "";
    let visibleCount = cards.length;
    let syncNote = "";

    const updateResults = () => {
      const noun = visibleCount === 1 ? "module" : "modules";
      results.textContent = query
        ? `${visibleCount} ${noun} found`
        : `${visibleCount} ${noun}, ${completedCount} completed${syncNote}`;
    };

    // state: { done, total, complete }
    const renderItem = (item, state) => {
      const percent = state.complete ? 100 : state.total ? Math.round((state.done / state.total) * 100) : 0;
      const started = !state.complete && state.done > 0;

      item.wrapper.classList.toggle("is-complete", state.complete);
      item.wrapper.classList.toggle("is-started", started);
      item.label.textContent = "";
      if (state.complete) item.label.append(icon("check-circle-fill"), "Completed");
      else if (started) item.label.append(`${state.done} of ${state.total} sections read`);
      else item.label.append("Not started");

      item.track.setAttribute("aria-valuenow", String(percent));
      item.fill.style.width = `${percent}%`;

      const verb = state.complete ? "Review lesson" : started ? "Continue lesson" : "Start lesson";
      item.button.textContent = verb;
      item.button.setAttribute("aria-label", `${verb}: ${item.title}`);
    };

    const countCompleted = (states) => {
      completedCount = states.filter((state) => state.complete).length;
      updateResults();
    };

    const localStates = items.map((item) => {
      const saved = readLocal(userId, item.file);
      return { done: saved.done, total: saved.total, complete: Boolean(saved.completedAt) };
    });
    items.forEach((item, index) => renderItem(item, localStates[index]));
    countCompleted(localStates);

    // Progress saved to the account may be newer than this browser's copy.
    fetchAllRemote(userId).then(async ({ rows, ok }) => {
      if (!ok) {
        if (userId) { syncNote = " (saved on this device only)"; updateResults(); }
        return;
      }

      // Progress made before the account table existed (or while offline) is
      // only in this browser. Send it up so the admin panel and other devices see it.
      const pushes = [];
      items.forEach((item) => {
        const saved = readLocal(userId, item.file);
        if (!saved.read.length && !saved.completedAt) return;
        const row = rows.find((entry) => entry.lesson_key === item.file.toLowerCase());
        const needsPush = !row
          || saved.done > (row.sections_done || 0)
          || (saved.completedAt && !row.completed_at);
        if (needsPush) pushes.push(saveRemote(userId, item.file, saved));
      });
      if (pushes.length) {
        const results = await Promise.all(pushes);
        if (results.some((saved) => !saved)) { syncNote = " (saved on this device only)"; updateResults(); }
      }

      const merged = items.map((item, index) => {
        const local = localStates[index];
        const row = rows.find((entry) => entry.lesson_key === item.file.toLowerCase());
        if (!row) return local;
        const remoteReadCount = Array.isArray(row.sections_read) ? row.sections_read.length : 0;
        const remoteDone = Math.max(Number(row.sections_done || 0), remoteReadCount);
        const complete = local.complete || Boolean(row.completed_at);
        const remoteBetter = remoteDone > local.done;
        return {
          done: remoteBetter ? remoteDone : local.done,
          total: remoteBetter || !local.total ? (row.total_sections || local.total) : local.total,
          complete
        };
      });
      items.forEach((item, index) => renderItem(item, merged[index]));
      countCompleted(merged);
    });

    const tools = createElement("div", "lesson-catalog-tools");
    const search = createElement("label", "lesson-search");
    const filter = document.createElement("input");
    filter.className = "lesson-filter";
    filter.type = "search";
    filter.placeholder = "Search lessons";
    filter.setAttribute("aria-label", "Search lessons");
    const microphone = document.createElement("button");
    microphone.className = "voice-search-button";
    microphone.type = "button";
    microphone.setAttribute("aria-label", "Search by voice");
    microphone.setAttribute("aria-pressed", "false");
    microphone.title = "Search by voice";
    const microphoneIcon = createElement("i", "bi bi-mic-fill");
    microphoneIcon.setAttribute("aria-hidden", "true");
    microphone.append(microphoneIcon);
    const voiceStatus = createElement("span", "voice-search-status");
    voiceStatus.setAttribute("aria-live", "polite");
    search.append(filter, microphone, voiceStatus);
    tools.append(search, results);
    header.after(tools);

    filter.addEventListener("input", () => {
      query = filter.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const matches = !query || card.textContent.toLowerCase().includes(query);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      visibleCount = visible;
      updateResults();
    });
    updateResults();
  }

  /* ---------------------------------------------------------------
     Lesson module
  --------------------------------------------------------------- */
  async function enhanceModule() {
    const main = document.querySelector("main.lesson-page");
    if (!main) return;

    const sections = [...main.querySelectorAll(":scope > section")].filter((section) => {
      return section.querySelector(".section-title, .organelle-name") || section.classList.contains("comparison-section");
    });
    if (!sections.length) return;

    const headingOf = (section) => section.querySelector(".section-title, .organelle-name");
    const titles = sections.map((section, index) => headingOf(section)?.textContent.trim() || `Section ${index + 1}`);

    // Stable ids for saving progress: the heading text, made unique.
    const usedKeys = {};
    const keys = titles.map((title) => {
      const base = slugify(title);
      usedKeys[base] = (usedKeys[base] || 0) + 1;
      return usedKeys[base] > 1 ? `${base}-${usedKeys[base]}` : base;
    });
    sections.forEach((section, index) => {
      if (!section.id) section.id = `lesson-section-${index + 1}`;
    });

    // The reference list does not have to be "read" to finish a lesson.
    const required = sections.map((section) => !section.classList.contains("references-section"));
    const requiredIndexes = sections.map((_, index) => index).filter((index) => required[index]);
    const total = requiredIndexes.length;

    const previousModule = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
    const nextModule = moduleIndex >= 0 && moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : null;
    const currentModule = moduleIndex >= 0 ? modules[moduleIndex] : null;

    const userId = await getUserId();
    const state = readLocal(userId, currentFile);
    const readKeys = new Set(state.read);

    /* ----- lesson bar ----- */
    const tools = createElement("nav", "lesson-tools");
    tools.setAttribute("aria-label", "Lesson navigation");
    main.classList.add("has-lesson-tools");

    const back = createElement("a", "lesson-back");
    back.href = "lesson.html";
    back.setAttribute("aria-label", "Back to all lessons");
    back.title = "All lessons";
    back.append(icon("book"), createElement("span", null, "All lessons"));

    const position = currentModule
      ? createElement("span", "lesson-position", `Module ${moduleIndex + 1} of ${modules.length}`)
      : null;

    const jump = createElement("label", "lesson-jump");
    const jumpLabel = createElement("span", null, "Jump to section");
    jumpLabel.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    const select = document.createElement("select");
    const options = sections.map((section, index) => {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = titles[index];
      select.append(option);
      return option;
    });
    jump.append(jumpLabel, select);

    const spacer = createElement("span", "lesson-tools-spacer");
    const progressText = createElement("span", "lesson-progress-text");
    const done = createElement("span", "lesson-done");
    done.hidden = true;
    done.append(icon("check-circle-fill"), "Completed");
    const sync = createElement("span", "lesson-sync");
    sync.hidden = true;

    const makeStep = (module, label, iconName, iconFirst) => {
      const link = createElement("a", "lesson-step");
      link.hidden = true;
      if (!module) return link;
      link.href = module.file;
      link.title = module.title;
      link.setAttribute("aria-label", `${label} lesson: ${module.title}`);
      const text = createElement("span", null, label);
      if (iconFirst) link.append(icon(iconName), text);
      else link.append(text, icon(iconName));
      pageExists(module.file).then((exists) => { link.hidden = !exists; });
      return link;
    };
    const previous = makeStep(previousModule, "Previous", "chevron-left", true);
    const next = makeStep(nextModule, "Next", "chevron-right", false);

    const line = createElement("span", "lesson-progress-line");
    const fill = createElement("span", "lesson-progress-fill");
    line.append(fill);

    tools.append(back);
    if (position) tools.append(position);
    tools.append(jump, spacer, progressText, sync, done, previous, next, line);
    main.prepend(tools);

    select.addEventListener("change", () => {
      document.getElementById(select.value)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    });

    /* ----- lesson header: module, read time, sections ----- */
    const hero = main.querySelector(".lesson-hero");
    if (hero) {
      const words = sections.reduce((count, section) => {
        const text = (section.innerText || "").trim();
        return count + (text ? text.split(/\s+/).length : 0);
      }, 0);
      const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
      const meta = createElement("ul", "lesson-meta");
      const addMeta = (iconName, text) => {
        const item = document.createElement("li");
        item.append(icon(iconName), text);
        meta.append(item);
      };
      if (currentModule) addMeta("journal-bookmark", `Module ${moduleIndex + 1} of ${modules.length}`);
      addMeta("clock", `About ${minutes} min read`);
      addMeta("list-ul", `${total} sections`);
      (hero.querySelector(".hero-content") || hero).append(meta);
    }

    /* ----- lesson end: completion panel + pager ----- */
    const completion = createElement("section", "lesson-complete");
    completion.setAttribute("aria-label", "Lesson complete");
    const completionCopy = createElement("div", "lesson-complete-copy");
    completionCopy.append(
      createElement("strong", null, "Lesson complete"),
      createElement("p", null, "You have read every section of this lesson.")
    );
    completion.append(icon("check-circle-fill"), completionCopy);
    if (currentModule && currentModule.quiz) {
      const quizLink = createElement("a", "lesson-action");
      quizLink.href = currentModule.quiz;
      quizLink.hidden = true;
      quizLink.append("Take the quiz", icon("arrow-right"));
      completion.append(quizLink);
      pageExists(currentModule.quiz).then((exists) => { quizLink.hidden = !exists; });
    }
    main.append(completion);

    const pager = createElement("nav", "lesson-pager");
    pager.setAttribute("aria-label", "Lesson pagination");
    const makePagerLink = (module, className, label, fallbackHref, fallbackTitle) => {
      const link = createElement("a", className);
      link.href = module ? module.file : fallbackHref;
      const text = createElement("span", "pager-text");
      text.append(
        createElement("span", "pager-label", module ? label : "Finished the course path"),
        createElement("span", "pager-title", module ? module.title : fallbackTitle)
      );
      if (className === "pager-prev") link.append(icon("arrow-left"), text);
      else link.append(text, icon("arrow-right"));
      return link;
    };
    if (previousModule) {
      const link = makePagerLink(previousModule, "pager-prev", "Previous lesson");
      pager.append(link);
      pageExists(previousModule.file).then((exists) => { link.hidden = !exists; });
    }
    const nextLink = nextModule
      ? makePagerLink(nextModule, "pager-next", "Next lesson")
      : makePagerLink(null, "pager-next", "", "lesson.html", "Back to all lessons");
    pager.append(nextLink);
    if (nextModule) {
      pageExists(nextModule.file).then((exists) => {
        if (!exists) {
          nextLink.href = "lesson.html";
          nextLink.querySelector(".pager-label").textContent = "More lessons coming";
          nextLink.querySelector(".pager-title").textContent = "Back to all lessons";
        }
      });
    }
    main.append(pager);

    /* ----- what has been read ----- */
    const marks = sections.map((section) => {
      const mark = icon("check-circle-fill");
      mark.classList.add("section-read-mark");
      mark.setAttribute("role", "img");
      mark.setAttribute("aria-label", "Read");
      mark.removeAttribute("aria-hidden");
      mark.hidden = true;
      const heading = headingOf(section);
      if (heading) heading.append(mark);
      return mark;
    });

    const doneCount = () => requiredIndexes.filter((index) => readKeys.has(keys[index])).length;
    const isComplete = () => Boolean(state.completedAt);

    const render = () => {
      const count = doneCount();
      const complete = isComplete();
      const shown = complete ? total : count;
      progressText.textContent = `${shown} of ${total} sections read`;
      fill.style.transform = `scaleX(${total ? shown / total : 0})`;
      done.hidden = !complete;
      completion.hidden = !complete;
      sections.forEach((section, index) => {
        const isRead = readKeys.has(keys[index]) || (complete && required[index]);
        section.classList.toggle("is-read", isRead);
        marks[index].hidden = !isRead;
        options[index].textContent = `${isRead ? "✓ " : ""}${titles[index]}`;
      });
    };

    const setSync = (status) => {
      sync.textContent = "";
      sync.hidden = status === "none";
      if (status === "saved") {
        sync.title = "Progress saved to your account";
        sync.setAttribute("aria-label", "Progress saved to your account");
        sync.append(icon("cloud-check"));
      } else if (status === "local") {
        sync.title = "Progress saved on this device only";
        sync.setAttribute("aria-label", "Progress saved on this device only");
        sync.append(icon("cloud-slash"));
      }
    };

    // ----- saving -----
    let saveTimer = null;
    let dirty = false;
    const persist = () => {
      state.read = [...readKeys];
      state.total = total;
      state.done = doneCount();
      writeLocal(userId, currentFile, state);
    };
    const flush = async () => {
      window.clearTimeout(saveTimer);
      saveTimer = null;
      if (!dirty || !userId) return;
      dirty = false;
      persist();
      const saved = await saveRemote(userId, currentFile, state);
      if (!saved) dirty = true;
      setSync(saved ? "saved" : "local");
    };
    const scheduleSave = () => {
      dirty = true;
      persist();
      if (!userId) return;
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(flush, SAVE_DELAY_MS);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);

    const markRead = (index) => {
      if (readKeys.has(keys[index])) return;
      readKeys.add(keys[index]);
      if (!state.completedAt && doneCount() === total) state.completedAt = new Date().toISOString();
      render();
      scheduleSave();
    };

    /* ----- resume prompt ----- */
    let resume = null;
    const showResume = () => {
      if (resume || !hero || isComplete() || window.scrollY > 100) return;
      const read = doneCount();
      const firstUnread = requiredIndexes.find((index) => !readKeys.has(keys[index]));
      if (read === 0 || firstUnread === undefined) return;

      resume = createElement("div", "lesson-resume");
      resume.setAttribute("role", "region");
      resume.setAttribute("aria-label", "Resume reading");
      const message = createElement("p", null, `You have read ${read} of ${total} sections. Pick up at "${titles[firstUnread]}".`);
      const go = createElement("button", "resume-go", "Continue reading");
      go.type = "button";
      const dismiss = createElement("button", "resume-dismiss", "Dismiss");
      dismiss.type = "button";
      resume.append(message, go, dismiss);
      hero.after(resume);
      go.addEventListener("click", () => {
        document.getElementById(sections[firstUnread].id)?.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start"
        });
        resume.hidden = true;
      });
      dismiss.addEventListener("click", () => { resume.hidden = true; });
    };

    render();
    showResume();
    setSync(userId ? (dirty ? "local" : "none") : "none");

    /* ----- merge with the copy saved to the account ----- */
    if (userId) {
      fetchRemote(userId, currentFile).then(({ row, ok }) => {
        if (!ok) { setSync("local"); return; }
        let localHasExtra = false;
        const remoteKeys = new Set(row?.sections_read || []);
        remoteKeys.forEach((key) => readKeys.add(key));
        readKeys.forEach((key) => { if (!remoteKeys.has(key)) localHasExtra = true; });
        if (row?.completed_at && !state.completedAt) state.completedAt = row.completed_at;
        if (!state.completedAt && total && doneCount() === total) state.completedAt = new Date().toISOString();
        if (state.completedAt && !row?.completed_at) localHasExtra = true;
        persist();
        render();
        showResume();
        if (localHasExtra) scheduleSave();
        else setSync("saved");
      });
    }

    /* ----- count a section as read after it stays in view ----- */
    const inView = new Set();
    const timers = new Map();
    const stopDwell = (index) => {
      window.clearTimeout(timers.get(index));
      timers.delete(index);
    };
    const startDwell = (index) => {
      if (readKeys.has(keys[index]) || timers.has(index) || document.visibilityState !== "visible") return;
      timers.set(index, window.setTimeout(() => {
        timers.delete(index);
        if (inView.has(index) && document.visibilityState === "visible") markRead(index);
      }, DWELL_MS));
    };

    const readingObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const index = sections.indexOf(entry.target);
        if (index < 0) return;
        if (entry.isIntersecting) {
          inView.add(index);
          startDwell(index);
        } else {
          inView.delete(index);
          stopDwell(index);
        }
      });
    }, { rootMargin: "-20% 0px -20% 0px", threshold: 0 });
    sections.forEach((section) => readingObserver.observe(section));

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") inView.forEach(startDwell);
      else [...timers.keys()].forEach(stopDwell);
    });

    /* ----- keep the section menu on the section being read ----- */
    const menuObserver = new IntersectionObserver((entries) => {
      const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (active) select.value = active.target.id;
    }, { rootMargin: "-18% 0px -65% 0px", threshold: [0, .25, .6] });
    sections.forEach((section) => menuObserver.observe(section));
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhanceCatalog();
    enhanceModule();
  });
})();