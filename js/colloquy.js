/**
 * colloquy.js — progressive talk with the angel
 *
 * A side-plane tree. Early asks are few. Relics, Fear Not, substitutes,
 * marks, and endings unlock later branches. Choices recompute from lore
 * and touched relics each time they are painted.
 */

import { throne } from "./throne.js";

const touched = new Set();
let rimTouched = false;
let aspectTouched = false;
let approached = false;

function crafted(id) {
  return !!document.querySelector(`[data-relic="${id}"]:not([hidden])`);
}

function revealed(id) {
  const el = document.getElementById(id);
  return !!(el && !el.hidden);
}

function held() {
  const L = throne.lore;
  return {
    knife: !!(L.knife || touched.has("knife") || touched.has("ritual") || touched.has("bound-knife") || touched.has("offering-blade") || touched.has("star-knife")),
    fire: !!(touched.has("fire") || touched.has("pyre") || touched.has("brand")),
    wood: !!(touched.has("wood") || touched.has("pyre") || touched.has("altar")),
    lamb: touched.has("lamb"),
    hill: !!(touched.has("hill") || touched.has("other-hill")),
    ram: touched.has("ram"),
    cord: !!(touched.has("cord") || touched.has("bound-knife") || touched.has("altar") || touched.has("brand")),
    name: !!(L.named || touched.has("name")),
    morning: touched.has("morning"),
    feared: L.feared >= 1,
    fed: L.fed >= 1,
    raptured: L.raptured >= 1 || throne.raptured,
    goat: !!(L.goat || touched.has("goat") || touched.has("bound-goat") || touched.has("marked-goat") || revealed("the-goat")),
    face: !!(L.face || touched.has("face") || revealed("boy-face")),
    isaac: !!(L.isaac || touched.has("isaac") || revealed("isaac-devil")),
    pentagram: !!(L.pentagram || L.praised || touched.has("pentagram") || touched.has("star-knife") || touched.has("devil-mark") || crafted("pentagram")),
    ritual: !!(touched.has("ritual") || touched.has("offering-blade") || crafted("ritual") || crafted("offering-blade")),
    judged: !!(L.judged || touched.has("slain-goat") || touched.has("wrong-smoke")),
    offered: !!L.offered,
    slain: !!L.angelSlain,
    ascended: !!L.ascended,
    forgot: !!L.forgotFace,
    petitions: (L.petitions || 0) > 0,
    aspect: aspectTouched || (throne.aspect && throne.aspect !== "witness"),
    rim: rimTouched,
    pyre: !!(touched.has("pyre") || crafted("pyre")),
    otherHill: !!(touched.has("other-hill") || crafted("other-hill")),
    bladeAngel: !!L.bladeAngel,
    bladeSelf: !!L.bladeSelf,
    canOffer: !!L.canOffer,
    approached,
  };
}

function C(label, to, when) {
  return when ? { label, to, when } : { label, to };
}

const again = C("I came about something else.", "open");
const bringBack = C("How do I bring him back?", "bring");

const NODES = {
  open: {
    line: (h) => {
      if (h.ascended) return "you are the looking now. he is still on the hill. a father is a small thing from here.";
      if (h.slain) return "the wheels have no one left to turn them. you still came to talk.";
      if (h.isaac) return "he is already wearing another hill. you still came asking.";
      if (h.offered) return "you already gave the living thing a father. do not ask him about the hill.";
      return "you came about a boy. the wheels have no boy in them. say what you came to say.";
    },
    choices: [
      C("Where is he?", "where"),
      bringBack,
      C("I will not ask you.", "refuse"),
      C("What of the ram?", "ram"),
      C("I told him Fear Not.", "fear", (h) => h.feared),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("He came back.", "isaac", (h) => h.isaac),
      C("I already offered.", "offered", (h) => h.offered),
    ],
  },

  where: {
    line: (h) => {
      if (h.isaac) return "he is here. he came back wearing another hill. that is not the same as walking him down.";
      if (h.offered) return "he is looking at you. you are the rest of the eyes. the boy is not in the asking.";
      return "not in the wheels. not under the wood. he is the walk you already finished.";
    },
    choices: [
      C("Then why can I still hear him?", "hear"),
      C("Is he dead?", "dead"),
      bringBack,
      C("I said his name.", "name", (h) => h.name),
      C("I have the look of him.", "face", (h) => h.face),
      C("He came back.", "isaac", (h) => h.isaac),
      C("I will not ask further.", "refuse"),
    ],
  },

  bring: {
    line: (h) => {
      if (h.ascended) return "you already finished him. the count kept you. that was not a return.";
      if (h.isaac) return "he is already back. that is not the mercy you meant. he came for the living thing.";
      if (h.pentagram) return "a mark is already left. the morning's name still fits it, if you can stand to say it.";
      if (h.goat) return "you already invented what the thicket withheld. a substitute is not a son. do not waste it.";
      return "a father does not get a list. the hill keeps what it was given. if you want him, you want another count.";
    },
    choices: [
      C("What count?", "count"),
      C("Another body, then.", "substitute"),
      C("Tell me plainly.", "plain"),
      C("I told him Fear Not.", "fear", (h) => h.feared),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Wood and fire know each other.", "pyre", (h) => h.fire && h.wood),
      C("Something else caught.", "goat", (h) => h.goat),
      C("A mark was left.", "mark", (h) => h.pentagram),
      C("He came back.", "isaac", (h) => h.isaac),
      C("I asked for him back already.", "asked", (h) => h.petitions),
      again,
    ],
  },

  refuse: {
    line: "then do not stand in the light asking with your face. go back to the grade.",
    choices: [
      C("I changed my mind.", "open"),
      C("What of the ram?", "ram"),
      C("I will not.", "colder"),
    ],
  },

  colder: {
    line: "good. the living thing prefers silence to a father who will not finish.",
    choices: [
      C("I will ask after all.", "open"),
    ],
  },

  ram: {
    line: (h) => (h.goat
      ? "nothing caught that first time. you invented the courtesy after the fact. something else is already in your hands."
      : "nothing caught. the thicket stayed empty. you invented the courtesy of a ram after the fact."),
    choices: [
      C("Then what caught?", "substitute"),
      bringBack,
      C("I found the empty thicket.", "thicket", (h) => h.ram),
      C("Something else caught.", "goat", (h) => h.goat),
      C("I pressed the measure.", "measure", (h) => h.rim),
      again,
    ],
  },

  hear: {
    line: "that is your own throat. the hill answers in it when you ask him to speak.",
    choices: [
      C("Ask him to speak?", "petition"),
      bringBack,
      C("I asked for him back already.", "asked", (h) => h.petitions),
      again,
    ],
  },

  dead: {
    line: (h) => (h.isaac
      ? "you finished the instruction once. he came back anyway. he is not a body you can walk down twice and call it mercy."
      : "you finished the instruction. no voice arrived. he is not a body you can walk down."),
    choices: [
      C("Then what walks down?", "substitute"),
      bringBack,
      C("He walked down already.", "isaac", (h) => h.isaac),
      again,
    ],
  },

  plain: {
    line: "plain is a knife without heat. I will not make you a list. the count is already written in your hands.",
    choices: [
      C("My hands, then.", "hands"),
      bringBack,
      C("I will not ask you.", "refuse"),
    ],
  },

  count: {
    line: "one death is cheap. one death is accepted. a mark is left only when the right throat is given the right blade. a boy can wear that mark if you still have his morning.",
    choices: [
      C("The right throat.", "throat"),
      C("His morning.", "nameHint"),
      C("Which blade?", "knife", (h) => h.knife),
      C("He asked after the lamb.", "lamb", (h) => h.lamb),
      C("I have another throat.", "goat", (h) => h.goat),
      C("A mark was left.", "mark", (h) => h.pentagram),
      bringBack,
    ],
  },

  throat: {
    line: "the count accepts a substitute if the blade is not ordinary. burn it without the count and you only make wrong smoke. a cheap death is not forgiven.",
    choices: [
      C("Another body, then.", "substitute"),
      C("Which blade?", "knife", (h) => h.knife),
      C("Something else caught.", "goat", (h) => h.goat),
      C("I wasted it.", "wasted", (h) => h.judged),
      bringBack,
    ],
  },

  substitute: {
    line: "a substitute is not a son. rams keep failing. if you invent what the thicket withheld, do not waste it with an ordinary cut.",
    choices: [
      C("Then what do I invent?", "lamb", (h) => h.lamb),
      C("He asked after the lamb.", "lamb", (h) => h.lamb),
      C("The ram is only an absence.", "thicket", (h) => h.ram),
      C("Something else caught.", "goat", (h) => h.goat),
      C("I did not waste it.", "mark", (h) => h.pentagram),
      C("I wasted it.", "wasted", (h) => h.judged),
      bringBack,
    ],
  },

  petition: {
    line: "ask for him back. it keeps the asking. it drops the name unless the name was his. hate and fear land too. it answers in the temperature you bring it.",
    choices: [
      C("I asked for him back already.", "asked", (h) => h.petitions),
      C("I said his name.", "name", (h) => h.name),
      bringBack,
      again,
    ],
  },

  asked: {
    line: (h) => (h.name
      ? "it kept the asking. saying it again does not walk him down. the heat was already spent."
      : "it kept the asking. it did not walk him down. if you put his name in the ask, that is a different heat."),
    choices: [
      C("His name, then.", "nameHint"),
      C("I said his name.", "name", (h) => h.name),
      bringBack,
      again,
    ],
  },

  hands: {
    line: "you bound him. you stacked what he carried. you reached. the heat and the blade still remember each other. the cord still knows a throat.",
    choices: [
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("The fire is still waiting.", "fire", (h) => h.fire),
      C("He carried the wood.", "wood", (h) => h.wood),
      C("The cord has not forgotten.", "cord", (h) => h.cord),
      bringBack,
      again,
    ],
  },

  nameHint: {
    line: "the morning still has his name. the wheels do not. if you call it you will have to look at him. naming him does not return him.",
    choices: [
      C("I said his name.", "name", (h) => h.name),
      C("The morning was already a lie.", "morning", (h) => h.morning),
      C("I have the look of him.", "face", (h) => h.face),
      C("A mark wants a name.", "mark", (h) => h.pentagram),
      bringBack,
    ],
  },

  fear: {
    line: (h) => (h.fed
      ? "you said it to him. he believed you. the words left your mouth. the light has had the word and is still empty of a father."
      : "you said it to him. he believed you. a courtesy, then a cord. the words are still in your mouth. the light has not had them."),
    choices: [
      C("The light.", "mouth"),
      C("I already fed it the word.", "fed", (h) => h.fed),
      bringBack,
      again,
    ],
  },

  mouth: {
    line: "the mouth is not a mouth. it wants the word, then the hand. offerings of language are cheap. trade requires a body.",
    choices: [
      C("I already fed it the word.", "fed", (h) => h.fed),
      C("I have been inside.", "inside", (h) => h.raptured),
      C("I told him Fear Not.", "fear", (h) => h.feared),
      C("I turned the blade on the living thing.", "blade", (h) => h.bladeAngel),
      bringBack,
    ],
  },

  fed: {
    line: "you are trying to buy him back. the light is still empty of a father. the mouth wants the hand, not the word.",
    choices: [
      C("I held the center.", "inside", (h) => h.raptured || h.canOffer),
      C("I gave the hand.", "offered", (h) => h.offered),
      C("I turned the blade on my own hand.", "blade", (h) => h.bladeSelf),
      bringBack,
    ],
  },

  inside: {
    line: "this is as close as a father gets. hold until you are the offering, or leave. the boy is not in here.",
    choices: [
      C("I stayed.", "offered", (h) => h.offered),
      C("He is not the offering now.", "isaac", (h) => h.isaac),
      C("I will leave this talk.", "colder"),
      bringBack,
    ],
  },

  knife: {
    line: (h) => {
      if (h.isaac) return "the first job is still in the hand. an ordinary blade wasted a substitute. a worse blade remembers the first throat.";
      if (h.ritual) return "your hands itch. the ritual already knew which face this was. an ordinary cut is a cheaper death.";
      return "you bound him. the knife looks flammable. an ordinary blade wastes a substitute. your hands itch for a worse job.";
    },
    choices: [
      C("Heat, then.", "fire", (h) => h.fire),
      C("The cord has not forgotten.", "cord", (h) => h.cord),
      C("I will not waste it.", "goat", (h) => h.goat),
      C("The ritual is already in the palm.", "ritual", (h) => h.ritual),
      C("The first job is still in the hand.", "second", (h) => h.isaac),
      C("I turned the blade on the living thing.", "blade", (h) => h.bladeAngel),
      C("I turned the blade on my own hand.", "blade", (h) => h.bladeSelf),
      bringBack,
    ],
  },

  fire: {
    line: "the blade would take this heat and keep it. wood still wants what you carried. heat without a count is only waste.",
    choices: [
      C("He carried the wood.", "wood", (h) => h.wood),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Wood and fire know each other.", "pyre", (h) => h.wood || h.pyre),
      C("I will not burn it cheap.", "goat", (h) => h.goat),
      bringBack,
    ],
  },

  wood: {
    line: "he carried it because you asked. it still wants the heat. wood and cord remember a place. it is still empty.",
    choices: [
      C("The fire is still waiting.", "fire", (h) => h.fire),
      C("The place.", "cord", (h) => h.cord),
      C("Wood and fire know each other.", "pyre", (h) => h.fire || h.pyre),
      bringBack,
    ],
  },

  pyre: {
    line: "the wood takes. the boy is not on it this time. a place can be ready and still empty of the right throat.",
    choices: [
      C("The right throat.", "throat"),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Something else caught.", "goat", (h) => h.goat),
      bringBack,
    ],
  },

  cord: {
    line: "the cord still remembers his wrists. it wants the blade back. it will find another body that will lie still.",
    choices: [
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Another body.", "goat", (h) => h.goat),
      C("He carried the wood.", "wood", (h) => h.wood),
      bringBack,
    ],
  },

  lamb: {
    line: "he asked. you said someone else would see to it. the hill already knew. the lamb you invent will not be him.",
    choices: [
      C("Then what do I invent?", "substitute"),
      C("I invented a goat.", "goat", (h) => h.goat),
      bringBack,
      again,
    ],
  },

  hill: {
    line: "three days up. you can still feel the grade. he is not under it. a star can remember a hill that was not this one.",
    choices: [
      C("Another hill.", "otherHill", (h) => h.pentagram || h.otherHill),
      C("Where is he?", "where"),
      bringBack,
      again,
    ],
  },

  morning: {
    line: "you told him it was only a walk. you were already lying. the morning still has his name.",
    choices: [
      C("His name.", "nameHint"),
      C("I said his name.", "name", (h) => h.name),
      bringBack,
    ],
  },

  thicket: {
    line: "pressed close, the thicket lies. pressed far, another name keeps the distance. the measure still asks how far.",
    choices: [
      C("How far?", "measure"),
      C("The lie came true.", "goat", (h) => h.goat),
      bringBack,
    ],
  },

  measure: {
    line: "how far from the rim to the boy you cannot see. the thicket only answers when you are already too close.",
    choices: [
      C("Something caught.", "goat", (h) => h.goat),
      C("What of the ram?", "ram"),
      bringBack,
      again,
    ],
  },

  name: {
    line: (h) => (h.face
      ? "he still turns toward that sound. his look is with you now. naming him does not return him."
      : "he still turns toward that sound. his face waits on that morning. calling it is a kind of looking."),
    choices: [
      C("I looked.", "face", (h) => h.face),
      C("The mark wants the morning's name.", "mark", (h) => h.pentagram),
      C("The morning was already a lie.", "morning", (h) => h.morning),
      bringBack,
    ],
  },

  face: {
    line: (h) => (h.forgot
      ? "you had the look. you put it into the living thing. the wheels ate it. you cannot put it back in your own head."
      : "you will have to look at him now. you cannot keep his face and the knife in the same hand. if you give the look, the wheels eat."),
    choices: [
      C("I already gave the look.", "forgot", (h) => h.forgot),
      C("I cannot keep both.", "knife", (h) => h.knife),
      C("The mark wants the living thing.", "mark", (h) => h.pentagram),
      C("He came back.", "isaac", (h) => h.isaac),
      bringBack,
    ],
  },

  forgot: {
    line: "you have the name. you do not have the face. the look went into the wheels and stayed gone. he is still the boy. you are the one who cannot see him.",
    choices: [
      C("He came back anyway.", "isaac", (h) => h.isaac),
      bringBack,
      again,
    ],
  },

  goat: {
    line: (h) => {
      if (h.judged) return "you already spent the substitute. the living thing will not forget the cheap death.";
      if (h.pentagram) return "the count accepted it. a mark is left where the goat was. that is the death that can wear a boy.";
      return "something caught. it was not a ram. the count will accept this death if the blade is not ordinary. burn it without the count and you only make wrong smoke.";
    },
    choices: [
      C("Which blade?", "knife", (h) => h.knife),
      C("I finished it correctly.", "mark", (h) => h.pentagram),
      C("I wasted it.", "wasted", (h) => h.judged),
      C("The fire is still waiting.", "fire", (h) => h.fire),
      bringBack,
    ],
  },

  wasted: {
    line: "it was not asked of you this way. a substitute can die two deaths. one of them is not forgiven.",
    choices: [
      bringBack,
      C("I will not ask further.", "colder"),
      again,
    ],
  },

  ritual: {
    line: "your hands itch. the last step is still a hand, or a substitute counted correctly. the ritual knife already knew which face this was.",
    choices: [
      C("The substitute.", "goat", (h) => h.goat),
      C("His face.", "face", (h) => h.face),
      C("The first job is still in the hand.", "second", (h) => h.isaac),
      C("I held the center.", "inside", (h) => h.raptured || h.canOffer),
      bringBack,
    ],
  },

  mark: {
    line: (h) => (h.isaac
      ? "the morning's name already fit. he came back wearing another hill. he is not the offering now."
      : "the count accepts the substitute. a mark is left. the morning's name fits the mark. the boy comes back wearing another hill."),
    choices: [
      C("I have his name.", "name", (h) => h.name),
      C("I have the look of him.", "face", (h) => h.face),
      C("He came back.", "isaac", (h) => h.isaac),
      C("Another hill answers.", "otherHill", (h) => h.otherHill || h.hill),
      bringBack,
    ],
  },

  otherHill: {
    line: "the star remembers a hill that was not this one. he is not the offering now. he is the other count.",
    choices: [
      C("He is here.", "isaac", (h) => h.isaac),
      C("The hill is still under us.", "hill", (h) => h.hill),
      bringBack,
    ],
  },

  isaac: {
    line: "he is already here. he came back for the living thing. you cannot hold him. he is already holding you.",
    choices: [
      C("What does he want?", "wants"),
      C("The first job is still in the hand.", "second", (h) => h.knife),
      C("I already gave the living thing.", "offered", (h) => h.offered),
      C("I finished it.", "ascended", (h) => h.ascended),
      C("The wheels are quiet.", "slain", (h) => h.slain),
      C("I will not ask further.", "colder"),
    ],
  },

  wants: {
    line: "the living thing that took him. or the look you still owe. or a second death with no voice after.",
    choices: [
      C("The look.", "face", (h) => h.face),
      C("A second death.", "second", (h) => h.knife),
      C("I already gave the look.", "forgot", (h) => h.forgot),
      bringBack,
    ],
  },

  second: {
    line: "you finish it this time. no voice arrives. the last step was always him. that is not a return.",
    choices: [
      C("I finished it.", "ascended", (h) => h.ascended),
      C("He is already here.", "isaac"),
      C("I will not.", "colder"),
    ],
  },

  offered: {
    line: "he blinks because he can. the count has a new rim. do not ask him about the hill. you are the rest of the eyes.",
    choices: [
      C("Where is the boy?", "where"),
      C("He came back after.", "isaac", (h) => h.isaac),
      again,
    ],
  },

  slain: {
    line: "he finished the count that finished him. the living thing is quiet. there is no one left to turn the wheels.",
    choices: [
      C("Sit with that.", "colder"),
      C("Begin the ask again.", "open"),
    ],
  },

  ascended: {
    line: "you are the looking now. he is still on the hill. the boy is finished. the count kept you.",
    choices: [
      C("Begin the ask again.", "open"),
    ],
  },

  blade: {
    line: (h) => {
      if (h.bladeSelf && h.offered) return "you turned the old instruction on the hand that raised it. the light had you. that is a father spent.";
      if (h.bladeSelf) return "you turn the old instruction on the hand that raised it. the light has not always had you yet.";
      return "the living thing takes the cut and keeps turning. a wound is not a return.";
    },
    choices: [
      C("The light.", "mouth"),
      C("I already offered.", "offered", (h) => h.offered),
      bringBack,
      again,
    ],
  },

  attendants: {
    line: "fourfold and also one. they will not introduce themselves. if you call them, the shape you first survived will not keep.",
    choices: [
      C("I pressed the measure.", "measure", (h) => h.rim),
      bringBack,
      again,
    ],
  },

  approach: {
    line: "it will not be touched directly. looking away was the approach. the door was never in front of you.",
    choices: [
      bringBack,
      again,
    ],
  },
};

function lineOf(node, h) {
  return typeof node.line === "function" ? node.line(h) : node.line;
}

function choicesOf(node, h) {
  const list = (node.choices || []).filter((c) => !c.when || c.when(h));
  if (h.hill && node === NODES.open) {
    if (!list.some((c) => c.to === "hill")) list.push(C("The hill is still under us.", "hill"));
  }
  if (h.morning && node === NODES.open) {
    if (!list.some((c) => c.to === "morning")) list.push(C("The morning was already a lie.", "morning"));
  }
  if (h.lamb && node === NODES.open) {
    if (!list.some((c) => c.to === "lamb")) list.push(C("He asked after the lamb.", "lamb"));
  }
  if (h.wood && node === NODES.open) {
    if (!list.some((c) => c.to === "wood")) list.push(C("He carried the wood.", "wood"));
  }
  if (h.fire && node === NODES.open) {
    if (!list.some((c) => c.to === "fire")) list.push(C("The fire is still waiting.", "fire"));
  }
  if (h.cord && node === NODES.open) {
    if (!list.some((c) => c.to === "cord")) list.push(C("The cord has not forgotten.", "cord"));
  }
  if (h.name && node === NODES.open) {
    if (!list.some((c) => c.to === "name")) list.push(C("I said his name.", "name"));
  }
  if (h.face && node === NODES.open) {
    if (!list.some((c) => c.to === "face")) list.push(C("I have the look of him.", "face"));
  }
  if (h.goat && node === NODES.open) {
    if (!list.some((c) => c.to === "goat")) list.push(C("Something else caught.", "goat"));
  }
  if (h.pentagram && node === NODES.open) {
    if (!list.some((c) => c.to === "mark")) list.push(C("A mark was left.", "mark"));
  }
  if (h.aspect && node === NODES.open) {
    if (!list.some((c) => c.to === "attendants")) list.push(C("The attendants have another shape.", "attendants"));
  }
  if (h.approached && node === NODES.open) {
    if (!list.some((c) => c.to === "approach")) list.push(C("I looked away from the door.", "approach"));
  }
  if (h.rim && node === NODES.open) {
    if (!list.some((c) => c.to === "measure")) list.push(C("I pressed the measure.", "measure"));
  }
  if (h.slain && node === NODES.open) {
    if (!list.some((c) => c.to === "slain")) list.push(C("The wheels are quiet.", "slain"));
  }
  if (h.ascended && node === NODES.open) {
    if (!list.some((c) => c.to === "ascended")) list.push(C("I finished it.", "ascended"));
  }
  if (h.forgot && node === NODES.open) {
    if (!list.some((c) => c.to === "forgot")) list.push(C("I already gave the look.", "forgot"));
  }
  return list.length ? list : [C("Begin the ask again.", "open")];
}

export function wireColloquy(audio) {
  const plane = document.getElementById("colloquy");
  const thread = document.getElementById("colloquy-thread");
  const box = document.getElementById("colloquy-choices");
  if (!plane || !thread || !box) return;

  let nodeId = "open";
  let busy = false;
  let lastChoiceKey = "";

  function append(kind, text) {
    const p = document.createElement("p");
    p.className = kind === "you" ? "inscription small colloquy-you" : "inscription colloquy-angel";
    p.textContent = text;
    thread.appendChild(p);
    while (thread.children.length > 8) thread.removeChild(thread.firstChild);
    thread.scrollTop = thread.scrollHeight;
  }

  function paintChoices() {
    const node = NODES[nodeId] || NODES.open;
    const h = held();
    const choices = choicesOf(node, h);
    const key = `${nodeId}|${choices.map((c) => c.to + ":" + c.label).join(";")}`;
    if (key === lastChoiceKey && box.childElementCount) return;
    lastChoiceKey = key;
    box.replaceChildren();
    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "colloquy-choice";
      btn.textContent = choice.label;
      btn.addEventListener("pointerenter", () => {
        if (throne.rng() > 0.45) audio.ping?.("hover");
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        choose(choice);
      });
      box.appendChild(btn);
    });
  }

  function showNode(id, speak) {
    const node = NODES[id] || NODES.open;
    nodeId = id;
    lastChoiceKey = "";
    const text = lineOf(node, held());
    if (speak) append("angel", text);
    paintChoices();
    plane.querySelector(".plane-body")?.scrollTo?.(0, 9999);
  }

  function choose(choice) {
    if (busy) return;
    const next = NODES[choice.to] ? choice.to : "open";
    busy = true;
    lastChoiceKey = "";
    append("you", choice.label);
    box.replaceChildren();
    const wait = document.createElement("p");
    wait.className = "colloquy-await";
    wait.textContent = "it is still looking";
    box.appendChild(wait);
    audio.ping?.("click");
    window.setTimeout(() => {
      busy = false;
      const node = NODES[next] || NODES.open;
      nodeId = next;
      append("angel", lineOf(node, held()));
      audio.utter?.();
      paintChoices();
      plane.querySelector(".plane-body")?.scrollTo?.(0, 9999);
    }, 340);
  }

  function markRelic(id) {
    if (!id) return;
    touched.add(id);
    if (!busy) paintChoices();
  }

  window.addEventListener("throne:relic", (e) => markRelic(e.detail?.id));
  window.addEventListener("throne:use", (e) => {
    markRelic(e.detail?.id);
    if (e.detail?.target) touched.add(`${e.detail.id}:${e.detail.target}`);
  });
  window.addEventListener("throne:fearnot", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:fed", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:offer", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:petition", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:rim", () => {
    rimTouched = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:aspect", () => {
    aspectTouched = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:seal", () => {
    aspectTouched = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:approach", () => {
    approached = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:spawn", (e) => markRelic(e.detail?.id));

  append("angel", lineOf(NODES.open, held()));
  paintChoices();
}
