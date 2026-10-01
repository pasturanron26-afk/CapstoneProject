(() => {
  const modules = [
    { file: "lessonModuleOne.html", title: "Cell Biology: Animal & Plant Cells" },
    { file: "Lessonmodulemitosis.html", title: "Mitosis: Cell Division" },
    { file: "lesson-cell-membrane.html", title: "Cell Membrane and Transport" },
    { file: "lesson-cell-respiration.html", title: "Cell Respiration" },
    { file: "lesson-photosynthesis.html", title: "Photosynthesis" }
  ];

  const currentFile = window.location.pathname.split("/").pop() || "lesson.html";
  const moduleIndex = modules.findIndex((item) => item.file.toLowerCase() === currentFile.toLowerCase());
  const storageKey = `ecolearn-lesson-progress:${currentFile.toLowerCase()}`;

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  function enhanceCatalog() {
    const list = document.querySelector(".lessons-list");
    const header = document.querySelector(".lessons-header");
    if (!list || !header) return;

    const cards = [...list.querySelectorAll(".lesson-card")];
    const tools = createElement("div", "lesson-catalog-tools");
    const filter = document.createElement("input");
    filter.className = "lesson-filter";
    filter.type = "search";
    filter.placeholder = "Search lessons";
    filter.setAttribute("aria-label", "Search lessons");
    const results = createElement("p", "lesson-results", `${cards.length} modules`);
    tools.append(filter, results);
    header.after(tools);

    const updateResults = () => {
      const query = filter.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const matches = !query || card.textContent.toLowerCase().includes(query);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      results.textContent = `${visible} ${visible === 1 ? "module" : "modules"}`;
    };
    filter.addEventListener("input", updateResults);
  }

  function enhanceModule() {
    const main = document.querySelector("main.lesson-page");
    if (!main || moduleIndex < 0) return;

    const sections = [...main.querySelectorAll(":scope > section")].filter((section) => {
      return section.querySelector(".section-title, .organelle-name") || section.classList.contains("comparison-section");
    });
    sections.forEach((section, index) => {
      if (!section.id) section.id = `lesson-section-${index + 1}`;
    });

    const tools = createElement("nav", "lesson-tools");
    tools.setAttribute("aria-label", "Lesson navigation");
    main.classList.add("has-lesson-tools");
    const back = document.createElement("a");
    back.href = "lesson.html";
    back.textContent = "Lessons";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Jump to lesson section");
    sections.forEach((section, index) => {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = section.querySelector(".section-title, .organelle-name")?.textContent.trim() || `Section ${index + 1}`;
      select.append(option);
    });
    const spacer = createElement("span", "lesson-tools-spacer");
    const progressText = createElement("span", "lesson-progress-text", "0% complete");
    const progressTrack = createElement("span", "lesson-progress-track");
    const progressFill = createElement("span", "lesson-progress-fill");
    progressTrack.append(progressFill);
    const progress = createElement("span", "lesson-tools-progress");
    progress.append(progressText, progressTrack);
    const previous = document.createElement("a");
    previous.textContent = "Previous";
    const next = document.createElement("a");
    next.textContent = "Next";
    if (moduleIndex > 0) previous.href = modules[moduleIndex - 1].file;
    else previous.hidden = true;
    if (moduleIndex < modules.length - 1) next.href = modules[moduleIndex + 1].file;
    else next.hidden = true;
    tools.append(back, select, spacer, progress, previous, next);
    main.prepend(tools);

    select.addEventListener("change", () => {
      document.getElementById(select.value)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const completion = createElement("div", "lesson-complete");
    const completionCopy = document.createElement("p");
    const completionTitle = createElement("strong", null, "Lesson complete");
    completionCopy.append(completionTitle, "You reached the end of this module.");
    const completionLink = document.createElement("a");
    completionLink.href = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1].file : "lesson.html";
    completionLink.textContent = moduleIndex < modules.length - 1 ? "Next module" : "Back to lessons";
    completion.append(completionCopy, completionLink);
    main.append(completion);

    const savedProgress = Number.parseInt(localStorage.getItem(storageKey) || "0", 10);
    let maxProgress = Number.isFinite(savedProgress) ? savedProgress : 0;
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const current = scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 100;
      maxProgress = Math.max(maxProgress, Math.min(100, current));
      localStorage.setItem(storageKey, String(maxProgress));
      progressFill.style.width = `${maxProgress}%`;
      progressText.textContent = `${maxProgress}% complete`;
      completion.hidden = maxProgress < 95;
    };
    completion.hidden = maxProgress < 95;
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });

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
