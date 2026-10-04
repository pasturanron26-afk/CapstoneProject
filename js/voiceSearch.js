(() => {
  const recognitions = new WeakMap();

  function updateStatus(button, message, label = message) {
    const container = button.closest("label");
    const status = container?.querySelector(".voice-search-status");
    if (status) status.textContent = message;
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  function setListening(button, listening) {
    button.classList.toggle("is-listening", listening);
    button.setAttribute("aria-pressed", String(listening));
    const icon = button.querySelector(".bi");
    if (icon) {
      icon.classList.toggle("bi-mic-fill", !listening);
      icon.classList.toggle("bi-mic-mute-fill", listening);
    }
  }

  function errorMessage(error) {
    switch (error) {
      case "not-allowed":
      case "service-not-allowed":
        return "Microphone access was denied. Allow microphone access and try again.";
      case "audio-capture":
        return "No microphone was found. Connect a microphone and try again.";
      case "network":
        return "Voice search needs a network connection. Check your connection and try again.";
      case "no-speech":
        return "No speech was detected. Try speaking again.";
      default:
        return "Voice search couldn't start. Please try again.";
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".voice-search-button");
    if (!button) return;

    const activeRecognition = recognitions.get(button);
    if (activeRecognition) {
      activeRecognition.stop();
      updateStatus(button, "Voice search stopped.", "Search by voice");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      updateStatus(button, "Voice search is not supported by this browser.", "Voice search is not supported by this browser.");
      return;
    }
    if (!window.isSecureContext) {
      updateStatus(button, "Voice search requires a secure connection (HTTPS or localhost).", "Voice search requires HTTPS or localhost.");
      return;
    }

    const input = button.closest("label")?.querySelector('input[type="search"]');
    if (!input) {
      updateStatus(button, "Voice search is unavailable for this field.", "Voice search is unavailable for this field.");
      return;
    }

    const recognition = new Recognition();
    let completed = false;
    let failed = false;
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(button, true);
      updateStatus(button, "Listening. Speak your search.", "Listening. Click to stop.");
    };
    recognition.onresult = (resultEvent) => {
      const transcript = resultEvent.results[0]?.[0]?.transcript?.trim();
      completed = true;
      if (!transcript) {
        updateStatus(button, "No speech was recognized. Try again.", "No speech was recognized. Click to try again.");
        return;
      }

      input.value = transcript;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      updateStatus(button, `Searching for: ${transcript}`, `Searching for: ${transcript}`);
    };
    recognition.onerror = (errorEvent) => {
      failed = true;
      const message = errorMessage(errorEvent.error);
      updateStatus(button, message, message);
    };
    recognition.onend = () => {
      recognitions.delete(button);
      setListening(button, false);
      if (!completed && !failed) updateStatus(button, "Voice search stopped.", "Search by voice");
    };

    recognitions.set(button, recognition);
    try {
      recognition.start();
    } catch (error) {
      recognitions.delete(button);
      setListening(button, false);
      const message = error.name === "NotAllowedError"
        ? errorMessage("not-allowed")
        : "Voice search couldn't start. Please try again.";
      updateStatus(button, message, message);
    }
  });
})();
