(() => {
  // Keep in step with the cards in lesson.html. Order is the study order.
  const modules = [
    { file: "lessonModuleOne.html", title: "Animal Cell vs Plant Cell", quiz: "quiz-animal-plant.html" },
    { file: "Lessonmodulemitosis.html", title: "Mitosis of Plant and Animal Cells", quiz: "quiz-mitosis.html" },
    { file: "lesson-cell-membrane.html", title: "Cell Membrane and Transport", quiz: "quiz-membrane.html" },
    { file: "lesson-cell-differentiation.html", title: "Cell Differentiation and Specialization", quiz: null },
    { file: "lesson-photosynthesis.html", title: "Photosynthesis", quiz: "quiz-photosynthesis.html" }
  ];

  const COMPLETE_AT = 95; // percent of the page scrolled that counts as finished
  const WORDS_PER_MINUTE = 200;

  const currentFile = window.location.pathname.split("/").pop() || "lesson.html";
  const moduleIndex = modules.findIndex((item) => item.file.toLowerCase() === currentFile.toLowerCase());
  const storageKeyFor = (file) => `ecolearn-lesson-progress:${file.toLowerCase()}`;
  const storageKey = storageKeyFor(currentFile);
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

  const readProgress = (file) => {
    try {
      const value = Number.parseInt(localStorage.getItem(storageKeyFor(file)) || "0", 10);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    } catch (error) {
      return 0;
    }
  };

  const writeProgress = (file, value) => {
    try { localStorage.setItem(storageKeyFor(file), String(value)); } catch (error) { /* storage blocked */ }
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
  function enhanceCatalog() {
    const list = document.querySelector(".lessons-list");
    const header = document.querySelector(".lessons-header");
    if (!list || !header) return;

    const cards = [...list.querySelectorAll(".lesson-card")];

    // Status and progress on every card, from what the student has already read.
    let completed = 0;
    cards.forEach((card) => {
      const button = card.querySelector(".card-btn");
      if (!button || button.classList.contains("is-disabled")) return;
      const file = (button.getAttribute("href") || "").split("/").pop();
      const progress = readProgress(file);
      const isComplete = progress >= COMPLETE_AT;
      const isStarted = progress > 0 && !isComplete;
      if (isComplete) completed += 1;

      const wrapper = createElement("div", "card-progress");
      if (isComplete) wrapper.classList.add("is-complete");
      if (isStarted) wrapper.classList.add("is-started");

      const label = createElement("p", "card-progress-label");
      if (isComplete) {
        label.append(icon("check-circle-fill"), "Completed");
      } else if (isStarted) {
        label.append(`${progress}% read`);
      } else {
        label.append("Not started");
      }

      const track = createElement("div", "card-progress-track");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", "Lesson progress");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(isComplete ? 100 : progress));
      const fill = createElement("span", "card-progress-fill");
      fill.style.width = `${isComplete ? 100 : progress}%`;
      track.append(fill);
      wrapper.append(label, track);
      button.before(wrapper);

      // The button says what happens next.
      const title = card.querySelector(".card-title")?.textContent.trim() || "lesson";
      const verb = isComplete ? "Review lesson" : isStarted ? "Continue lesson" : "Start lesson";
      button.textContent = "";
      button.append(verb);
      button.setAttribute("aria-label", `${verb}: ${title}`);
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
    const results = createElement("p", "lesson-results");
    tools.append(search, results);
    header.after(tools);

    const updateResults = () => {
      const query = filter.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const matches = !query || card.textContent.toLowerCase().includes(query);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      const noun = visible === 1 ? "module" : "modules";
      results.textContent = query
        ? `${visible} ${noun} found`
        : `${visible} ${noun}, ${completed} completed`;
    };
    filter.addEventListener("input", updateResults);
    updateResults();
  }

  /* ---------------------------------------------------------------
     Lesson module
  --------------------------------------------------------------- */
  function enhanceModule() {
    const main = document.querySelector("main.lesson-page");
    if (!main) return;

    const sections = [...main.querySelectorAll(":scope > section")].filter((section) => {
      return section.querySelector(".section-title, .organelle-name") || section.classList.contains("comparison-section");
    });
    sections.forEach((section, index) => {
      if (!section.id) section.id = `lesson-section-${index + 1}`;
    });
    const sectionTitle = (section, index) =>
      section.querySelector(".section-title, .organelle-name")?.textContent.trim() || `Section ${index + 1}`;

    const previousModule = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
    const nextModule = moduleIndex >= 0 && moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : null;
    const currentModule = moduleIndex >= 0 ? modules[moduleIndex] : null;

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
    sections.forEach((section, index) => {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = sectionTitle(section, index);
      select.append(option);
    });
    jump.append(jumpLabel, select);

    const spacer = createElement("span", "lesson-tools-spacer");
    const progressText = createElement("span", "lesson-progress-text", "0% read");
    const done = createElement("span", "lesson-done");
    done.hidden = true;
    done.append(icon("check-circle-fill"), "Completed");

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
    tools.append(jump, spacer, progressText, done, previous, next, line);
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
      const words = sections.reduce((total, section) => {
        const text = (section.innerText || "").trim();
        return total + (text ? text.split(/\s+/).length : 0);
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
      addMeta("list-ul", `${sections.length} sections`);
      (hero.querySelector(".hero-content") || hero).append(meta);
    }

    /* ----- lesson end: completion panel + pager ----- */
    const completion = createElement("section", "lesson-complete");
    completion.setAttribute("aria-label", "Lesson complete");
    const completionCopy = createElement("div", "lesson-complete-copy");
    completionCopy.append(
      createElement("strong", null, "Lesson complete"),
      createElement("p", null, "You reached the end of this lesson.")
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
    if (nextModule) pageExists(nextModule.file).then((exists) => {
      if (!exists) {
        nextLink.href = "lesson.html";
        nextLink.querySelector(".pager-label").textContent = "More lessons coming";
        nextLink.querySelector(".pager-title").textContent = "Back to all lessons";
      }
    });
    main.append(pager);

    /* ----- reading progress ----- */
    let maxProgress = readProgress(currentFile);
    const wasComplete = maxProgress >= COMPLETE_AT;
    let ticking = false;

    const updateProgress = () => {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const current = scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 100;
      const clamped = Math.max(0, Math.min(100, current));
      if (clamped > maxProgress) {
        maxProgress = clamped;
        writeProgress(currentFile, maxProgress);
      }
      fill.style.transform = `scaleX(${clamped / 100})`;
      progressText.textContent = `${clamped}% read`;
      const finished = maxProgress >= COMPLETE_AT;
      done.hidden = !finished;
      completion.hidden = !finished;
    };
    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgress);
      }
    };
    completion.hidden = !wasComplete;
    done.hidden = !wasComplete;
    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    /* ----- resume prompt ----- */
    if (hero && maxProgress >= 5 && maxProgress < COMPLETE_AT && window.scrollY < 100) {
      const resume = createElement("div", "lesson-resume");
      resume.setAttribute("role", "region");
      resume.setAttribute("aria-label", "Resume reading");
      const message = createElement("p", null, `You stopped at ${maxProgress}% of this lesson.`);
      const go = createElement("button", "resume-go", "Continue reading");
      go.type = "button";
      const dismiss = createElement("button", "resume-dismiss", "Dismiss");
      dismiss.type = "button";
      resume.append(message, go, dismiss);
      hero.after(resume);
      go.addEventListener("click", () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({
          top: (scrollable * maxProgress) / 100,
          behavior: prefersReducedMotion() ? "auto" : "smooth"
        });
        resume.hidden = true;
      });
      dismiss.addEventListener("click", () => { resume.hidden = true; });
    }

    /* ----- keep the section menu on the section being read ----- */
    const observer = new IntersectionObserver((entries) => {
      const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (active) select.value = active.target.id;
    }, { rootMargin: "-18% 0px -65% 0px", threshold: [0, .25, .6] });
    sections.forEach((section) => observer.observe(section));
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhanceCatalog();
    enhanceModule();
  });
})();