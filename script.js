// ==========================================================================
// MAIN SITE
// Runs on window "load", once every image/font/stylesheet has actually
// settled — that matters here because Lenis and ScrollTrigger both take
// measurements of the page (heights, positions), and those need the real
// laid-out page, not one that's still shifting around mid-load.
// ==========================================================================
function startSite() {
// ========== SMOOTH SCROLL (Lenis) ==========
  const lenis = new Lenis({ duration: 1, smoothWheel: true });
  gsap.registerPlugin(ScrollTrigger);
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // ========== LOGO — click scrolls to top ==========
  function initLogo() {
    const logo = document.getElementById("logoDB");
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      lenis.scrollTo(0);
    });
  }

  // ========== SOUND TOGGLE — vibrates + shakes, swaps label on click ==========
  function initSoundToggle() {
    const btn = document.getElementById("soundToggle");
    const label = btn.querySelector(".sound-label");
    const audio = document.getElementById("bgAudio");
    let isPlaying = false;

    btn.addEventListener("click", () => {
      // real device vibration where supported (mostly Android Chrome)
      if (navigator.vibrate) navigator.vibrate(150);

      // visual "vibrate" feedback everywhere else
      btn.classList.remove("is-vibrating");
      void btn.offsetWidth; // restart animation
      btn.classList.add("is-vibrating");

      isPlaying = !isPlaying;
      // no emoji swap — the ♪ mark stays, CSS just recolors it via .is-playing
      btn.classList.toggle("is-playing", isPlaying);
      label.textContent = isPlaying ? "sound: on" : "sound: off";

      if (isPlaying) {
        audio.play().catch(() => {
          /* no audio source added yet — button still toggles silently */
        });
      } else {
        audio.pause();
      }
    });
  }

  // ========== SCROLL REVEALS for cards / tags ==========
  // Note: .ticket is deliberately excluded — it has its own hover-only
  // reveal (see .envelope-wrap:hover .ticket in style.css). Including it
  // here used to break that, because GSAP sets opacity via inline style,
  // which always overrides a stylesheet rule regardless of specificity.
  function initScrollReveals() {
    const targets = document.querySelectorAll(
      ".index-card, .skill-tag, .postcard, .letter-form, .sticky-note"
    );
    targets.forEach((el, i) => {
      gsap.set(el, { opacity: 0, y: 24 });
      ScrollTrigger.create({
        trigger: el,
        start: "top 90%",
        onEnter: () =>
          gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay: (i % 4) * 0.05, ease: "power2.out" }),
      });
    });
  }

  // ========== DIAGONAL DRIFT — each section's inner content nudges
  // left/right as it scrolls through the viewport, alternating per
  // section. Combined with the zigzagging track, this is what gives the
  // page its diagonal feel without breaking native vertical scrolling
  // (which stays fully intact for accessibility / trackpads / mobile). ==========
  function initDiagonalDrift() {
    document.querySelectorAll(".section-inner").forEach((el, i) => {
      const direction = i % 2 === 0 ? 1 : -1;
      gsap.fromTo(
        el,
        { x: -30 * direction },
        {
          x: 30 * direction,
          ease: "none",
          scrollTrigger: {
            trigger: el.closest(".section"),
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    });
  }

  // ========== TRAIN TRACK — a smooth curved path drawn once down the
  // whole page (rails + ties, decorative only, sit behind content). The
  // train itself no longer "walks" the document-relative path — instead
  // it's position:fixed and always vertically centered in the viewport,
  // sliding left/right to match wherever the SAME sine curve crosses the
  // center of the screen at the current scroll position. Both use the
  // same trackXAt() formula, so the train always reads as riding the
  // track even though it never leaves the vertical center. ==========
  const trackParams = { laneCenter: 0, amplitude: 0, wavelength: 1250 };

  // the single source of truth for the curve — both the rails (sampled
  // via the SVG path below) and the train's live position (computed
  // directly, no SVG geometry needed) come from this same formula
  function trackXAt(y) {
    return trackParams.laneCenter + trackParams.amplitude * Math.sin((y / trackParams.wavelength) * Math.PI * 2);
  }

  function buildTrackPath() {
    const wrapper = document.getElementById("trackWrapper");
    const svg = document.getElementById("trackSvg");
    const path = document.getElementById("trackPath");

    const height = wrapper.scrollHeight;
    const width = wrapper.clientWidth;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    trackParams.laneCenter = width * 0.5;
    trackParams.amplitude = width * 0.36; // swings roughly from 14% to 86% of the width
    const stepY = 24; // small steps = smooth curve, not jagged

    let d = "";
    for (let y = 0; y <= height; y += stepY) {
      const x = trackXAt(y);
      d += (y === 0 ? "M " : "L ") + x + " " + y + " ";
    }

    path.setAttribute("d", d);
    buildRails(path);
    buildTies(path);
  }

  // derives two parallel rail paths by sampling the center path and
  // offsetting each sample point perpendicular to its direction of travel
  function buildRails(centerPath) {
    const total = centerPath.getTotalLength();
    const railOffset = 16; // half the gap between the two rails — bump for a wider track
    const step = 24;
    let left = "";
    let right = "";

    for (let len = 0; len <= total; len += step) {
      const p = centerPath.getPointAtLength(len);
      const p2 = centerPath.getPointAtLength(Math.min(len + 1, total));
      const dx = p2.x - p.x;
      const dy = p2.y - p.y;
      const mag = Math.hypot(dx, dy) || 1;
      const nx = -dy / mag;
      const ny = dx / mag;

      const lx = p.x + nx * railOffset;
      const ly = p.y + ny * railOffset;
      const rx = p.x - nx * railOffset;
      const ry = p.y - ny * railOffset;

      left += (len === 0 ? "M " : "L ") + lx + " " + ly + " ";
      right += (len === 0 ? "M " : "L ") + rx + " " + ry + " ";
    }

    document.getElementById("trackRailLeft").setAttribute("d", left);
    document.getElementById("trackRailRight").setAttribute("d", right);
  }

  // scatters short perpendicular "sleeper" marks along the center path
  function buildTies(centerPath) {
    const group = document.getElementById("trackTies");
    group.innerHTML = "";

    const total = centerPath.getTotalLength();
    const spacing = 46; // distance between ties — smaller = denser railway
    const tieHalfWidth = 22;

    for (let len = 0; len < total; len += spacing) {
      const p = centerPath.getPointAtLength(len);
      const p2 = centerPath.getPointAtLength(Math.min(len + 1, total));
      const dx = p2.x - p.x;
      const dy = p2.y - p.y;
      const mag = Math.hypot(dx, dy) || 1;
      const nx = -dy / mag;
      const ny = dx / mag;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", p.x - nx * tieHalfWidth);
      line.setAttribute("y1", p.y - ny * tieHalfWidth);
      line.setAttribute("x2", p.x + nx * tieHalfWidth);
      line.setAttribute("y2", p.y + ny * tieHalfWidth);
      line.setAttribute("class", "track-tie");
      group.appendChild(line);
    }
  }

  // ---- train motion: fixed + vertically centered, eased horizontal
  // sway driven by scroll, plus a small constant idle wiggle so it never
  // looks frozen ----
  let targetTrainX = 0;
  let currentTrainX = 0;

  function updateTrainTarget() {
    // the document Y that's currently at the vertical center of the
    // viewport — the train's X always matches the track curve AT that Y
    const centerDocY = window.scrollY + window.innerHeight / 2;
    targetTrainX = trackXAt(centerDocY);
  }

  function trainAnimationLoop(now) {
    const train = document.getElementById("trainEl");

    // ease toward the target rather than snapping — this is what makes
    // the motion soft and "slightly fast, not too quick" instead of
    // jumping to a new spot on every scroll event
    currentTrainX += (targetTrainX - currentTrainX) * 0.05;

    // tiny constant idle sway so the train is always visibly alive, even
    // when scroll hasn't moved (fixes it "standing stationary")
    const idleWiggle = Math.sin(now / 900) * 5;

    train.style.transform = `translate(${currentTrainX + idleWiggle}px, -50%) translateX(-50%)`;
    requestAnimationFrame(trainAnimationLoop);
  }

  function initTrain() {
    buildTrackPath();
    updateTrainTarget();
    window.addEventListener("scroll", updateTrainTarget, { passive: true });
    requestAnimationFrame(trainAnimationLoop);

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        buildTrackPath();
        updateTrainTarget();
      }, 150);
    });
  }

  // ========== RESUME ENVELOPE — CSS handles the hover reveal; this just
  // adds a click fallback for touch devices, which don't have hover ==========
  function initEnvelope() {
    const wrap = document.getElementById("envelopeWrap");
    const trigger = document.getElementById("envelopeTrigger");
    if (!wrap || !trigger) return;

    trigger.addEventListener("click", () => {
      const isOpen = wrap.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // ========== CONTACT MAILBOX — click reveals the letter form + postcard ==========
  function initMailbox() {
    const wrap = document.getElementById("mailboxWrap");
    const trigger = document.getElementById("mailboxTrigger");
    const hint = trigger?.querySelector(".mailbox-hint");
    if (!wrap || !trigger) return;

    trigger.addEventListener("click", () => {
      const isOpen = wrap.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (hint) hint.textContent = isOpen ? "click to close" : "click to open";
    });
  }

  // ========== MINI POPUP — themed toast for form feedback ==========
  let miniPopupTimer;

  function showMiniPopup(message) {
    const popup = document.getElementById("miniPopup");
    const text = document.getElementById("miniPopupText");
    text.textContent = message;
    popup.classList.add("is-visible");

    clearTimeout(miniPopupTimer);
    miniPopupTimer = setTimeout(() => {
      popup.classList.remove("is-visible");
    }, 3200);
  }

  // ========== PROJECT MODALS — open/close, sliding in from the right ==========
  let openModal = null;

  function openProjectModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("is-open");
    openModal = modal;
  }

  function closeProjectModal() {
    if (openModal) openModal.classList.remove("is-open");
    openModal = null;
  }

  function initProjectModals() {
    document.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("click", () => openProjectModal(card.dataset.modal));
    });
    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeProjectModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeProjectModal();
    });
  }

  // ========== NAV-FREE ANCHOR LINKS (quick links on home) ==========
  function initAnchorLinks() {
    document.querySelectorAll('a[href^="#"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        const targetId = el.getAttribute("href")?.replace("#", "");
        const target = document.getElementById(targetId);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target);
      });
    });
  }

  // ========== PENCIL SCRATCH TRAIL — draws a thin ink line following the
  // cursor across the whole page, like the pencil cursor is literally
  // scratching the paper. Canvas is sized to the full document (in
  // document coordinates, not viewport), so the trail stays put on the
  // page as you scroll. Persists until refresh — nothing ever clears it,
  // other than the unavoidable clear-on-resize (handled by re-drawing the
  // previous trail back onto the newly-sized canvas). ==========
  function initScratchTrail() {
    const canvas = document.getElementById("scratchCanvas");
    const wrapper = document.getElementById("trackWrapper");
    const ctx = canvas.getContext("2d");

    function applyStrokeStyle() {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(30, 32, 36, 0.32)"; // matches --ink
      ctx.lineWidth = 1.4;
    }

    function resizeCanvas() {
      const newWidth = wrapper.clientWidth;
      const newHeight = wrapper.scrollHeight;
      if (canvas.width === newWidth && canvas.height === newHeight) return;

      // canvas.width/height resets both the pixel buffer AND all context
      // state, so capture the existing trail first and redraw it after
      const hadContent = canvas.width > 0 && canvas.height > 0;
      const previous = hadContent ? canvas.toDataURL() : null;

      canvas.width = newWidth;
      canvas.height = newHeight;
      applyStrokeStyle();

      if (previous) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = previous;
      }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // catches page-height growth from late-loading images/fonts
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(wrapper);
    }

    let lastX = null;
    let lastY = null;

    window.addEventListener("mousemove", (e) => {
      const x = e.clientX;
      const y = e.clientY + window.scrollY;

      if (lastX === null) {
        lastX = x;
        lastY = y;
        return;
      }

      const dist = Math.hypot(x - lastX, y - lastY);
      if (dist < 4) return; // throttle — avoids thousands of tiny segments

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;
    });
  }

  // ========== EMAILJS — one-time init so .send() below can just fire ==========
  // Public key is meant to be exposed client-side (that's how EmailJS
  // works — it's not a secret like an API key would be), so shipping it
  // in this file is expected and fine.
  const EMAILJS_PUBLIC_KEY = "TITdKZY8J5jtgJkY3";
  const EMAILJS_SERVICE_ID = "service_8lv8lkt";
  const EMAILJS_TEMPLATE_ID = "template_cs43g5o";

  function initEmailJS() {
    if (typeof emailjs === "undefined") return; // SDK failed to load — form falls back to mailto below
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  // ========== LETTER FORM — validates with the themed mini popup, sends
  // via EmailJS, and falls back to a prefilled mailto if that fails for
  // any reason (offline, ad-blocker, misconfigured template, etc.) so a
  // written letter never just vanishes ==========
  function initLetterForm() {
    const form = document.getElementById("letterForm");
    const sendBtn = form.querySelector(".send-btn");
    const sendBtnDefaultLabel = sendBtn.textContent;

    const emptyMessages = [
      "uh oh — looks like you left something blank. even doodles need an email to reply to.",
      "this section's looking a little empty, chief.",
      "404: form field not found. please fill it in.",
      "my inbox can't read minds (yet).",
    ];
    const badEmailMessages = [
      "that doesn't look like a real email — did autocomplete betray you?",
      "pretty sure that email is missing an @ (or several characters).",
    ];
    const successMessages = [
      "letter sent! it's really in my inbox this time, not just your email app.",
      "delivered — no train required.",
      "message received. I'll write back, promise.",
    ];

    function mailtoFallback(name, email, message) {
      const to = "bhattadibyant@gmail.com";
      const subject = encodeURIComponent(`A letter from ${name}`);
      const body = encodeURIComponent(`${message}\r\n\r\n— ${name} (${email})`);
      setTimeout(() => {
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
      }, 400); // lets the popup show before the email app takes over
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      if (!name || !email || !message) {
        showMiniPopup(emptyMessages[Math.floor(Math.random() * emptyMessages.length)]);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMiniPopup(badEmailMessages[Math.floor(Math.random() * badEmailMessages.length)]);
        return;
      }

      // SDK never loaded (blocked, offline, CDN hiccup) — skip straight
      // to the fallback rather than calling a function that doesn't exist
      if (typeof emailjs === "undefined") {
        showMiniPopup(successMessages[Math.floor(Math.random() * successMessages.length)]);
        mailtoFallback(name, email, message);
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = "sending…";

      emailjs
        // sending every common alias for each field, since different
        // EmailJS default templates expect different placeholder names
        // ({{name}} vs {{from_name}}, etc.) — whichever ones your template
        // actually uses will get filled in, the rest are just ignored
        .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          name: name,
          from_name: name,
          user_name: name,
          email: email,
          from_email: email,
          user_email: email,
          reply_to: email,
          message: message,
          user_message: message,
        })
        .then(() => {
          showMiniPopup(successMessages[Math.floor(Math.random() * successMessages.length)]);
          form.reset();
        })
        .catch((err) => {
          console.error("EmailJS send failed:", err);
          showMiniPopup("that letter got lost in the mail — opening your email app instead.");
          mailtoFallback(name, email, message);
        })
        .finally(() => {
          sendBtn.disabled = false;
          sendBtn.textContent = sendBtnDefaultLabel;
        });
    });
  }

  // ========== RESUME — opens in a brand new tab so the portfolio tab
  // (music included) just keeps running in the background untouched,
  // instead of navigating away from it. Fails gracefully with a friendly
  // popup instead of a broken tab if the PDF is ever missing or renamed ==========
  function initResumeDownload() {
    const link = document.getElementById("resumeDownload");
    if (!link) return;
    const pdfPath = link.getAttribute("href");

    const successMessages = [
      "resume opened in a new tab! no train ticket required.",
      "boom — resume's up. use it wisely.",
      "there it is, fresh off the printer (metaphorically).",
      "new tab, who dis. (it's the resume.)",
    ];
    const missingMessage =
      "uh oh — the resume seems to have wandered off. try refreshing, or just email me directly.";

    link.addEventListener("click", (e) => {
      e.preventDefault();

      // open the tab synchronously, directly inside the click handler —
      // this has to happen before any await/fetch or popup blockers will
      // treat it as not user-initiated and block it. the portfolio tab
      // (and whatever's playing on it) is never touched.
      const resumeTab = window.open(pdfPath, "_blank", "noopener,noreferrer");

      if (!resumeTab) {
        // popup blocked — fall back to a plain same-behavior click instead
        // of silently failing
        const a = document.createElement("a");
        a.href = pdfPath;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }

      // fetch() over file:// is blocked/unreliable in most browsers, so
      // skip the existence check there and just assume it worked — this
      // is what makes it work when testing locally by double-clicking
      // Index.html instead of through a server
      if (location.protocol === "file:" || typeof fetch !== "function") {
        showMiniPopup(successMessages[Math.floor(Math.random() * successMessages.length)]);
        return;
      }

      fetch(pdfPath, { method: "HEAD" })
        .then((res) => {
          showMiniPopup(
            res.ok
              ? successMessages[Math.floor(Math.random() * successMessages.length)]
              : missingMessage
          );
        })
        .catch(() => {
          // a network hiccup or a server that doesn't support HEAD isn't
          // proof the file is missing — don't second-guess the tab that
          // already opened
          showMiniPopup(successMessages[Math.floor(Math.random() * successMessages.length)]);
        });
    });
  }

  // ========== FOOTER YEAR ==========
  function setFooterYear() {
    document.getElementById("year").textContent = new Date().getFullYear();
  }

  // this is the actual kickoff — everything above just defines the
  // functions, this is what actually runs them
  initEmailJS();
  initLogo();
  initSoundToggle();
  initScrollReveals();
  initDiagonalDrift();
  initTrain();
  initEnvelope();
  initMailbox();
  initProjectModals();
  initAnchorLinks();
  initLetterForm();
  initResumeDownload();
  initScratchTrail();
  setFooterYear();
}

// no more loading screen to hand off from — just run once the page (and
// its images/fonts) has actually finished loading
if (document.readyState === "complete") {
  startSite();
} else {
  window.addEventListener("load", startSite);
}