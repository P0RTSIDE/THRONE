/**
 * Backstage panel. Opened by a typed phrase the page does not advertise.
 */

import { throne, showCaption } from "./throne.js";

const ASPECTS = [
  ["witness", "the first shape"],
  ["unblinking", "no lid will close"],
  ["merkavah", "the chariot"],
  ["waters", "the deep"],
  ["seraph", "the fire stands"],
  ["inverted", "the cut"],
  ["name", "one true eye"],
  ["hush", "the hush"],
  ["offered", "the taken father"],
  ["ascended", "the looking"],
  ["judged", "the bad count"],
  ["praised", "the accepted count"],
  ["slain", "the dead wheels"],
  ["adversary", "the other hill"],
];

function inTypingField(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function createGodMode({ audio, wheel, arg }) {
  let unlocked = false;
  let typed = "";

  const root = document.createElement("aside");
  root.id = "backstage";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="backstage-head">
      <h2>BACKSTAGE</h2>
      <button type="button" class="backstage-close" aria-label="close">close</button>
    </div>
    <p class="backstage-note">Play the living thing. Open any locked beat. This stays for the session.</p>
    <div class="backstage-cols">
      <section>
        <h3>Play</h3>
        <div class="backstage-grid" data-pack="play"></div>
      </section>
      <section>
        <h3>Unlock</h3>
        <div class="backstage-grid" data-pack="unlock"></div>
      </section>
    </div>
  `;
  document.body.appendChild(root);

  const chip = document.createElement("button");
  chip.type = "button";
  chip.id = "backstage-chip";
  chip.hidden = true;
  chip.textContent = "backstage";
  document.body.appendChild(chip);

  const play = root.querySelector('[data-pack="play"]');
  const unlock = root.querySelector('[data-pack="unlock"]');

  function addBtn(host, label, fn) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    host.appendChild(btn);
  }

  addBtn(play, "eat the look", () => wheel.wearFace?.());
  addBtn(play, "weep", () => wheel.weep?.());
  addBtn(play, "finish the boy", () => wheel.ascend?.());
  addBtn(play, "slay the wheels", () => wheel.slay?.());
  addBtn(play, "take the father", () => wheel.offer?.());
  addBtn(play, "wound", () => wheel.wound?.());
  addBtn(play, "bleed", () => wheel.bleed?.());
  addBtn(play, "one true eye", () => wheel.showFace?.());
  addBtn(play, "pulse", () => wheel.pulse?.());
  addBtn(play, "shudder", () => wheel.shudder?.());
  addBtn(play, "fall in", () => wheel.fallIn?.());
  addBtn(play, "open a far eye", () => wheel.openDistantEye?.());
  addBtn(play, "enter the center", () => {
    wheel.setRapture?.(true);
    audio.setRapture?.(true);
  });
  addBtn(play, "leave the center", () => {
    wheel.setRapture?.(false);
    audio.setRapture?.(false);
  });
  addBtn(play, "spin hard", () => wheel.setSpinBoost?.(4.2));
  addBtn(play, "spin rest", () => wheel.setSpinBoost?.(1));
  addBtn(play, "gold metal", () => wheel.setPalette?.(0));
  addBtn(play, "pale metal", () => wheel.setPalette?.(1));
  addBtn(play, "utter", () => audio.utter?.());
  addBtn(play, "strike", () => audio.strike?.());
  addBtn(play, "scream", () => audio.scream?.());
  for (const [id, label] of ASPECTS) {
    addBtn(play, label, () => {
      wheel.setAspect?.(id);
      audio.setAspect?.(id);
      wheel.pulse?.();
    });
  }

  addBtn(unlock, "name him", () => arg.backstage?.nameHim?.());
  addBtn(unlock, "show his face", () => arg.backstage?.showHisFace?.());
  addBtn(unlock, "show the goat", () => arg.backstage?.revealGoat?.());
  addBtn(unlock, "bring the boy back", () => arg.backstage?.summonIsaac?.());
  addBtn(unlock, "confess", () => arg.backstage?.confess?.());
  addBtn(unlock, "find the knife", () => arg.backstage?.findKnife?.());
  addBtn(unlock, "leave the mark", () => arg.backstage?.leaveMark?.());
  addBtn(unlock, "judge badly", () => arg.backstage?.judgeBadly?.());
  addBtn(unlock, "accept the substitute", () => arg.backstage?.praiseYou?.());
  addBtn(unlock, "forget the look", () => arg.backstage?.forgetLook?.());
  addBtn(unlock, "feed the light", () => arg.backstage?.feed?.());
  addBtn(unlock, "speak fear not", () => arg.backstage?.fear?.());
  addBtn(unlock, "enter the count", () => arg.backstage?.rapture?.());
  addBtn(unlock, "leave the count", () => arg.backstage?.leaveCenter?.());
  addBtn(unlock, "offer the father", () => arg.backstage?.offer?.());
  addBtn(unlock, "slay the living thing", () => arg.backstage?.slayAngel?.());
  addBtn(unlock, "finish him", () => arg.backstage?.finishTheBoy?.());
  addBtn(unlock, "show every relic", () => {
    ["boy-face", "the-goat", "isaac-devil"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = false;
      el.removeAttribute("aria-hidden");
    });
    document.querySelectorAll(".world-relic").forEach((el) => {
      el.hidden = false;
      el.removeAttribute("aria-hidden");
    });
    throne.lore.goat = true;
    throne.lore.face = true;
    throne.lore.isaac = true;
    throne.lore.named = true;
    throne.lore.knife = true;
    throne.lore.pentagram = true;
    document.documentElement.classList.add("knife-found");
    arg.backstage?.refreshOffer?.();
  });

  function open() {
    unlocked = true;
    root.hidden = false;
    root.removeAttribute("aria-hidden");
    chip.hidden = true;
    document.documentElement.classList.add("backstage-open");
  }

  function close() {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("backstage-open");
    if (unlocked) chip.hidden = false;
  }

  root.querySelector(".backstage-close")?.addEventListener("click", close);
  chip.addEventListener("click", open);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !root.hidden) {
      e.stopImmediatePropagation();
      close();
      return;
    }
    if (inTypingField(e.target)) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-24);
    if (typed.includes("fartgoblin")) {
      typed = "";
      if (!throne.entered) return;
      open();
      showCaption("the wings are open.", 2400);
    }
  }, true);

  return { open, close };
}
