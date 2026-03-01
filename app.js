const STORAGE_KEY = "robotics-team-builder-state-v1";
const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const TIME_OPTIONS = buildTimeOptions();

const defaultState = createDefaultState();
let state = cloneData(defaultState);
let dragState = null;
let activeTeamPointerDrag = null;
const expandedStudentIds = new Set();

const statusBar = document.querySelector(".status-bar");
const statusMessage = document.getElementById("statusMessage");
const csvInput = document.getElementById("csvInput");
const exportButton = document.getElementById("exportButton");
const addStudentButton = document.getElementById("addStudentButton");
const addTeamButton = document.getElementById("addTeamButton");
const addSlotButton = document.getElementById("addSlotButton");
const resetButton = document.getElementById("resetButton");
const studentSearch = document.getElementById("studentSearch");
const studentPool = document.getElementById("studentPool");
const teamsGrid = document.getElementById("teamsGrid");
const studentPoolCount = document.getElementById("studentPoolCount");
const teamCount = document.getElementById("teamCount");
const studentDialog = document.getElementById("studentDialog");
const studentDialogTitle = document.getElementById("studentDialogTitle");
const studentForm = document.getElementById("studentForm");
const teamDialog = document.getElementById("teamDialog");
const teamDialogTitle = document.getElementById("teamDialogTitle");
const teamForm = document.getElementById("teamForm");
const slotDialog = document.getElementById("slotDialog");
const slotDialogTitle = document.getElementById("slotDialogTitle");
const slotForm = document.getElementById("slotForm");
const studentTeamSelect = document.getElementById("studentTeamId");
const slotDaySelect = document.getElementById("slotDay");
const slotStartTimeSelect = document.getElementById("slotStartTime");
const slotEndTimeSelect = document.getElementById("slotEndTime");

state = loadState();
initialize();

function initialize() {
  populateTimeSelect(slotStartTimeSelect, "Select start time");
  populateTimeSelect(slotEndTimeSelect, "Select end time");
  bindGlobalEvents();
  render();
}

function bindGlobalEvents() {
  csvInput.addEventListener("change", handleCsvImport);
  exportButton.addEventListener("click", handleExportTeams);
  addStudentButton.addEventListener("click", () => openStudentDialog());
  addTeamButton.addEventListener("click", () => openTeamDialog());
  addSlotButton.addEventListener("click", () => openSlotDialog());
  resetButton.addEventListener("click", handleResetBoard);
  studentSearch.addEventListener("input", render);

  studentForm.addEventListener("submit", handleStudentFormSubmit);
  teamForm.addEventListener("submit", handleTeamFormSubmit);
  slotForm.addEventListener("submit", handleSlotFormSubmit);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialogId = button.getAttribute("data-close-dialog");
      document.getElementById(dialogId).close();
    });
  });

  studentPool.addEventListener("dragover", (event) => handleStudentDragOver(event, studentPool));
  studentPool.addEventListener("dragleave", () => studentPool.classList.remove("is-active"));
  studentPool.addEventListener("drop", (event) => handleStudentDrop(event, null, studentPool));
}

function createDefaultState() {
  return {
    students: [],
    teams: [
      createTeam("Team 1", 1),
      createTeam("Team 2", 2),
    ],
    slots: [],
    nextStudentId: 1,
    nextTeamId: 3,
    nextSlotId: 1,
  };
}

function createTeam(name, id = undefined, overrides = {}) {
  return {
    id: id ?? Date.now(),
    name,
    slotId: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTimeSlot(id = undefined, overrides = {}) {
  return {
    id: id ?? Date.now(),
    day: "",
    startTime: "",
    endTime: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createStudent(overrides = {}) {
  return {
    id: overrides.id ?? Date.now(),
    name: "",
    age: "",
    grade: "",
    school: "",
    classesTaken: "",
    competitionExperience: "",
    timePreferences: ["", "", ""],
    commitment: "",
    specialRequest: "",
    teamId: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneData(defaultState);
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    setStatus("Could not load saved data. Starting from a clean board.", true);
    return cloneData(defaultState);
  }
}

function normalizeState(parsed) {
  let slots = Array.isArray(parsed.slots)
    ? parsed.slots.map((slot, index) => createTimeSlot(Number(slot.id) || index + 1, {
      day: normalizeDay(slot.day),
      startTime: normalizeTimeValue(slot.startTime),
      endTime: normalizeTimeValue(slot.endTime),
      createdAt: slot.createdAt || new Date().toISOString(),
    }))
    : [];

  let nextSlotId = inferNextId(slots);
  if (Number(parsed.nextSlotId) > nextSlotId) {
    nextSlotId = Number(parsed.nextSlotId);
  }

  const slotKeyToId = new Map();
  slots.forEach((slot) => {
    if (isSlotComplete(slot)) {
      slotKeyToId.set(getTimeSlotKey(slot), slot.id);
    }
  });

  function ensureLegacySlot(day, startTime, endTime) {
    if (!(day && startTime && endTime)) {
      return null;
    }

    const key = getTimeSlotKey({ day, startTime, endTime });
    if (slotKeyToId.has(key)) {
      return slotKeyToId.get(key);
    }

    const slot = createTimeSlot(nextSlotId, { day, startTime, endTime });
    slots.push(slot);
    slotKeyToId.set(key, slot.id);
    nextSlotId += 1;
    return slot.id;
  }

  const rawTeams = Array.isArray(parsed.teams) ? parsed.teams : cloneData(defaultState.teams);
  let teams = rawTeams.map((team, index) => {
    let slotId = normalizeNullableNumber(team.slotId);

    if (slotId === null) {
      const legacyDay = normalizeDay(team.day);
      const legacyStartTime = normalizeTimeValue(team.startTime);
      const legacyEndTime = normalizeTimeValue(team.endTime);
      slotId = ensureLegacySlot(legacyDay, legacyStartTime, legacyEndTime);
    }

    return createTeam(team.name || `Team ${index + 1}`, Number(team.id) || index + 1, {
      slotId,
      createdAt: team.createdAt || new Date().toISOString(),
    });
  });

  const validSlotIds = new Set(slots.map((slot) => slot.id));
  teams = teams.map((team) => ({
    ...team,
    slotId: validSlotIds.has(team.slotId) ? team.slotId : null,
  }));

  const validTeamIds = new Set(teams.map((team) => team.id));
  const students = Array.isArray(parsed.students)
    ? parsed.students.map((student, index) => {
      const teamId = normalizeNullableNumber(student.teamId);
      return {
        ...createStudent(),
        ...student,
        id: Number(student.id) || index + 1,
        teamId: validTeamIds.has(teamId) ? teamId : null,
        timePreferences: normalizeTimePreferences(student.timePreferences, student),
      };
    })
    : [];

  const nextTeamId = Math.max(Number(parsed.nextTeamId) || 0, inferNextId(teams));
  const nextStudentId = Math.max(Number(parsed.nextStudentId) || 0, inferNextId(students));
  nextSlotId = Math.max(nextSlotId, inferNextId(slots));

  return {
    students,
    teams,
    slots,
    nextStudentId,
    nextTeamId,
    nextSlotId,
  };
}

function inferNextId(items) {
  const maxId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
  return maxId + 1;
}

function normalizeTimePreferences(timePreferences, student = {}) {
  if (Array.isArray(timePreferences)) {
    const normalized = timePreferences.slice(0, 3).map((value) => `${value || ""}`.trim());
    while (normalized.length < 3) {
      normalized.push("");
    }
    return normalized;
  }

  return [
    `${student.timePreference1 || ""}`.trim(),
    `${student.timePreference2 || ""}`.trim(),
    `${student.timePreference3 || ""}`.trim(),
  ];
}

function normalizeDay(value) {
  const normalized = `${value || ""}`.trim();
  return DAYS_OF_WEEK.includes(normalized) ? normalized : "";
}

function normalizeTimeValue(value) {
  const normalized = `${value || ""}`.trim();
  return TIME_OPTIONS.some((option) => option.value === normalized) ? normalized : "";
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  const filteredStudents = getFilteredStudents();
  const slotGroups = getSlotGroups();
  const poolStudents = state.students.filter((student) => student.teamId === null);
  const assignedStudents = state.students.length - poolStudents.length;

  renderStudentPool(filteredStudents);
  renderTimeSlots(filteredStudents, slotGroups);
  renderStudentFormTeamOptions();

  studentPoolCount.textContent = `${poolStudents.length} unassigned / ${state.students.length} total`;
  teamCount.textContent = `${state.teams.length} teams / ${state.slots.length} time slots / ${assignedStudents} assigned`;
}

function renderStudentPool(filteredStudents) {
  const students = filteredStudents.filter((student) => student.teamId === null);
  studentPool.replaceChildren();

  if (!students.length) {
    studentPool.append(createEmptyState(
      state.students.length
        ? "No unassigned students match the current filter."
        : "No students yet. Import a CSV or add students manually."
    ));
    return;
  }

  students.forEach((student) => studentPool.append(createStudentCard(student)));
}

function renderTimeSlots(filteredStudents, slotGroups) {
  teamsGrid.replaceChildren();

  if (!state.teams.length && !state.slots.length) {
    teamsGrid.append(createEmptyState("No teams or time slots yet. Add both to start building the board."));
    return;
  }

  const filteredStudentIds = new Set(filteredStudents.map((student) => student.id));
  slotGroups.forEach((group) => {
    teamsGrid.append(createSlotSection(group, filteredStudentIds));
  });
}

function createSlotSection(group, filteredStudentIds) {
  const section = document.createElement("section");
  section.className = "schedule-slot";

  const header = document.createElement("div");
  header.className = "schedule-group-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "schedule-group-title";

  const title = document.createElement("h3");
  title.textContent = group.slot ? getTimeSlotLabel(group.slot) : "Unscheduled Teams";

  const meta = document.createElement("p");
  meta.className = "panel-meta";
  meta.textContent = group.teams.length === 1 ? "1 team" : `${group.teams.length} teams`;

  titleGroup.append(title, meta);
  header.append(titleGroup);

  if (group.slot) {
    const actions = document.createElement("div");
    actions.className = "slot-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "mini-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openSlotDialog(group.slot));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "mini-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteTimeSlot(group.slot.id));

    actions.append(editButton, deleteButton);
    header.append(actions);
  }

  const dropzone = document.createElement("div");
  dropzone.className = "slot-dropzone";
  dropzone.dataset.slotId = group.slot?.id === undefined ? "" : `${group.slot?.id ?? ""}`;

  const grid = document.createElement("div");
  grid.className = "schedule-group-grid";

  if (!group.teams.length) {
    grid.append(createEmptyState(
      group.slot
        ? "Drag team cards here to assign them to this time slot."
        : "Teams without a slot stay here. Drag them into a time slot when ready."
    ));
  } else {
    group.teams.forEach((team) => {
      grid.append(createTeamCard(team, filteredStudentIds));
    });
  }

  dropzone.append(grid);
  section.append(header, dropzone);
  return section;
}

function createTeamCard(team, filteredStudentIds) {
  const teamCard = document.createElement("section");
  teamCard.className = "team-card";

  const header = document.createElement("div");
  header.className = "team-card-header";
  header.addEventListener("pointerdown", (event) => handleTeamPointerDown(event, team.id, teamCard));

  const titleGroup = document.createElement("div");
  titleGroup.className = "team-title-group";

  const title = document.createElement("h3");
  title.textContent = team.name;

  const meta = document.createElement("p");
  const totalInTeam = state.students.filter((student) => student.teamId === team.id).length;
  meta.className = "panel-meta";
  meta.textContent = totalInTeam === 1 ? "1 student" : `${totalInTeam} students`;

  titleGroup.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "team-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "mini-button";
  editButton.textContent = "Edit";
  editButton.draggable = false;
  editButton.addEventListener("click", () => openTeamDialog(team));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "mini-button";
  deleteButton.textContent = "Delete";
  deleteButton.draggable = false;
  deleteButton.addEventListener("click", () => deleteTeam(team.id));

  actions.append(editButton, deleteButton);
  header.append(titleGroup, actions);

  const studentDropzone = document.createElement("div");
  studentDropzone.className = "team-slot";
  studentDropzone.dataset.teamId = `${team.id}`;
  studentDropzone.addEventListener("dragover", (event) => handleStudentDragOver(event, studentDropzone));
  studentDropzone.addEventListener("dragleave", () => studentDropzone.classList.remove("is-active"));
  studentDropzone.addEventListener("drop", (event) => handleStudentDrop(event, team.id, studentDropzone));

  const students = state.students.filter(
    (student) => student.teamId === team.id && filteredStudentIds.has(student.id)
  );

  if (!students.length) {
    studentDropzone.append(createEmptyState(
      totalInTeam
        ? "No students in this team match the current filter."
        : "Drop students here to build this team."
    ));
  } else {
    students.forEach((student) => studentDropzone.append(createStudentCard(student)));
  }

  teamCard.append(header, studentDropzone);
  return teamCard;
}

function createStudentCard(student) {
  const isAssigned = student.teamId !== null;
  const isExpanded = !isAssigned || expandedStudentIds.has(student.id);
  const card = document.createElement("article");
  card.className = `student-card${isAssigned && !isExpanded ? " is-collapsed" : ""}`;
  card.draggable = true;
  card.dataset.studentId = `${student.id}`;
  card.addEventListener("dragstart", (event) => handleStudentDragStart(event, student.id, card));
  card.addEventListener("dragend", () => handleDragEnd(card, "dragging"));

  const header = document.createElement("div");
  header.className = "student-header";

  const titleGroup = document.createElement("div");
  const studentName = student.name || "Unnamed Student";

  if (isAssigned) {
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "student-name-button";
    titleButton.textContent = studentName;
    titleButton.addEventListener("click", () => {
      if (!isExpanded) {
        setStudentExpanded(student.id, true);
      }
    });
    titleGroup.append(titleButton);
  } else {
    const title = document.createElement("h3");
    title.textContent = studentName;
    titleGroup.append(title);
  }

  if (isExpanded) {
    const metaRow = document.createElement("div");
    metaRow.className = "meta-row";
    [
      student.age ? `Age ${student.age}` : "",
      student.grade ? `Grade ${student.grade}` : "",
      student.school || "",
    ].filter(Boolean).forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "meta-chip";
      chip.textContent = value;
      metaRow.append(chip);
    });

    if (metaRow.childNodes.length) {
      titleGroup.append(metaRow);
    }
  }

  header.append(titleGroup);

  if (isExpanded) {
    const actions = document.createElement("div");
    actions.className = "student-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "mini-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openStudentDialog(student));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "mini-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteStudent(student.id));

    actions.append(editButton, deleteButton);
    header.append(actions);
  }

  card.append(header);

  if (isExpanded) {
    const detailsGrid = document.createElement("div");
    detailsGrid.className = "details-grid";

    [
      { label: "Classes", value: student.classesTaken },
      { label: "Competition", value: student.competitionExperience },
      { label: "Commitment", value: student.commitment },
      { label: "Special Request", value: student.specialRequest, full: true },
    ].forEach((detail) => {
      if (!detail.value) {
        return;
      }

      detailsGrid.append(createDetailBlock(detail.label, detail.value, detail.full));
    });

    const timePreferences = student.timePreferences.filter(Boolean);
    if (timePreferences.length) {
      detailsGrid.append(createDetailBlock("Time Preferences", timePreferences.join("\n"), true));
    }

    if (detailsGrid.childNodes.length) {
      card.append(detailsGrid);
    }
  }

  const footer = document.createElement("div");
  footer.className = "student-footer";

  const moveGroup = document.createElement("div");
  moveGroup.className = "student-select";

  const moveLabel = document.createElement("label");
  moveLabel.textContent = "Move to";
  moveLabel.setAttribute("for", `move-student-${student.id}`);

  const moveSelect = document.createElement("select");
  moveSelect.id = `move-student-${student.id}`;
  moveSelect.append(new Option("Student Pool", ""));
  [...state.teams].sort(compareTeamsByName).forEach((team) => {
    moveSelect.append(new Option(team.name, `${team.id}`));
  });
  moveSelect.value = student.teamId === null ? "" : `${student.teamId}`;
  moveSelect.addEventListener("change", (event) => {
    moveStudent(student.id, event.target.value === "" ? null : Number(event.target.value));
  });

  moveGroup.append(moveLabel, moveSelect);
  footer.append(moveGroup);

  if (isAssigned && isExpanded) {
    const collapseButton = document.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "mini-button";
    collapseButton.textContent = "Collapse";
    collapseButton.addEventListener("click", () => setStudentExpanded(student.id, false));
    footer.append(collapseButton);
  }

  card.append(footer);
  return card;
}

function createDetailBlock(label, value, full = false) {
  const block = document.createElement("div");
  block.className = full ? "detail-block full" : "detail-block";

  const detailLabel = document.createElement("span");
  detailLabel.className = "detail-label";
  detailLabel.textContent = label;

  const text = document.createElement("p");
  text.className = "detail-text";
  text.textContent = value;

  block.append(detailLabel, text);
  return block;
}

function createEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function getFilteredStudents() {
  const query = studentSearch.value.trim().toLowerCase();
  if (!query) {
    return [...state.students];
  }

  return state.students.filter((student) => {
    const searchText = [
      student.name,
      student.age,
      student.grade,
      student.school,
      student.classesTaken,
      student.competitionExperience,
      student.commitment,
      student.specialRequest,
      ...(student.timePreferences || []),
    ].join(" ").toLowerCase();

    return searchText.includes(query);
  });
}

function getSlotGroups() {
  const teamsBySlotId = new Map();
  const unscheduledTeams = [];

  getSortedSlots().forEach((slot) => teamsBySlotId.set(slot.id, []));

  [...state.teams].sort(compareTeamsByName).forEach((team) => {
    if (team.slotId !== null && teamsBySlotId.has(team.slotId)) {
      teamsBySlotId.get(team.slotId).push(team);
      return;
    }

    unscheduledTeams.push(team);
  });

  const groups = [{ slot: null, teams: unscheduledTeams }];
  getSortedSlots().forEach((slot) => {
    groups.push({
      slot,
      teams: teamsBySlotId.get(slot.id) || [],
    });
  });

  return groups;
}

function getSortedSlots() {
  return [...state.slots].sort(compareTimeSlots);
}

function compareTeamsByName(a, b) {
  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareStudentsByName(a, b) {
  return (a.name || "").localeCompare(b.name || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareTimeSlots(a, b) {
  const dayOrder = getDaySortIndex(a.day) - getDaySortIndex(b.day);
  if (dayOrder !== 0) {
    return dayOrder;
  }

  const startOrder = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
  if (startOrder !== 0) {
    return startOrder;
  }

  const endOrder = (a.endTime || "99:99").localeCompare(b.endTime || "99:99");
  if (endOrder !== 0) {
    return endOrder;
  }

  return Number(a.id) - Number(b.id);
}

function getDaySortIndex(day) {
  const index = DAYS_OF_WEEK.indexOf(day);
  return index === -1 ? DAYS_OF_WEEK.length : index;
}

function getTimeSlotKey(slot) {
  return [slot.day || "", slot.startTime || "", slot.endTime || ""].join("|");
}

function getTimeSlotLabel(slot) {
  if (!slot) {
    return "Unscheduled";
  }

  return `${slot.day} • ${formatTimeLabel(slot.startTime)} - ${formatTimeLabel(slot.endTime)}`;
}

function isSlotComplete(slot) {
  return Boolean(slot.day && slot.startTime && slot.endTime);
}

function renderStudentFormTeamOptions(selectedTeamId = "") {
  const currentValue = selectedTeamId === "" ? studentTeamSelect.value : `${selectedTeamId}`;
  studentTeamSelect.replaceChildren();
  studentTeamSelect.append(new Option("Student Pool", ""));
  [...state.teams].sort(compareTeamsByName).forEach((team) => {
    studentTeamSelect.append(new Option(team.name, `${team.id}`));
  });
  studentTeamSelect.value = currentValue;
}

function openStudentDialog(student = null) {
  studentDialogTitle.textContent = student ? "Edit Student" : "Add Student";
  studentForm.reset();
  renderStudentFormTeamOptions(student?.teamId ?? "");

  document.getElementById("studentId").value = student?.id ?? "";
  document.getElementById("studentName").value = student?.name ?? "";
  document.getElementById("studentAge").value = student?.age ?? "";
  document.getElementById("studentGrade").value = student?.grade ?? "";
  document.getElementById("studentSchool").value = student?.school ?? "";
  document.getElementById("studentClassesTaken").value = student?.classesTaken ?? "";
  document.getElementById("studentCompetitionExperience").value = student?.competitionExperience ?? "";
  document.getElementById("studentTimePreference1").value = student?.timePreferences?.[0] ?? "";
  document.getElementById("studentTimePreference2").value = student?.timePreferences?.[1] ?? "";
  document.getElementById("studentTimePreference3").value = student?.timePreferences?.[2] ?? "";
  document.getElementById("studentCommitment").value = student?.commitment ?? "";
  document.getElementById("studentSpecialRequest").value = student?.specialRequest ?? "";
  studentTeamSelect.value = student?.teamId === null || student?.teamId === undefined ? "" : `${student.teamId}`;

  studentDialog.showModal();
}

function openTeamDialog(team = null) {
  teamDialogTitle.textContent = team ? "Edit Team" : "Add Team";
  teamForm.reset();
  document.getElementById("teamId").value = team?.id ?? "";
  document.getElementById("teamName").value = team?.name ?? "";
  teamDialog.showModal();
}

function openSlotDialog(slot = null) {
  slotDialogTitle.textContent = slot ? "Edit Time Slot" : "Add Time Slot";
  slotForm.reset();
  document.getElementById("slotId").value = slot?.id ?? "";
  slotDaySelect.value = slot?.day ?? "";
  slotStartTimeSelect.value = slot?.startTime ?? "";
  slotEndTimeSelect.value = slot?.endTime ?? "";
  slotDialog.showModal();
}

function handleStudentFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(studentForm);
  const studentId = formData.get("studentId");
  const nextStudent = createStudent({
    id: studentId ? Number(studentId) : state.nextStudentId,
    name: `${formData.get("name") || ""}`.trim(),
    age: `${formData.get("age") || ""}`.trim(),
    grade: `${formData.get("grade") || ""}`.trim(),
    school: `${formData.get("school") || ""}`.trim(),
    classesTaken: `${formData.get("classesTaken") || ""}`.trim(),
    competitionExperience: `${formData.get("competitionExperience") || ""}`.trim(),
    timePreferences: [
      `${formData.get("timePreference1") || ""}`.trim(),
      `${formData.get("timePreference2") || ""}`.trim(),
      `${formData.get("timePreference3") || ""}`.trim(),
    ],
    commitment: `${formData.get("commitment") || ""}`.trim(),
    specialRequest: `${formData.get("specialRequest") || ""}`.trim(),
    teamId: formData.get("teamId") === "" ? null : Number(formData.get("teamId")),
  });

  if (!nextStudent.name) {
    setStatus("Student name is required.", true);
    return;
  }

  if (studentId) {
    state.students = state.students.map((student) => student.id === Number(studentId)
      ? { ...student, ...nextStudent }
      : student);
    setStatus(`Updated ${nextStudent.name}.`);
  } else {
    state.students.push(nextStudent);
    state.nextStudentId += 1;
    setStatus(`Added ${nextStudent.name}.`);
  }

  if (nextStudent.teamId !== null) {
    expandedStudentIds.delete(nextStudent.id);
  }

  saveAndRender();
  studentDialog.close();
}

function handleTeamFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(teamForm);
  const teamId = formData.get("teamId");
  const teamName = `${formData.get("name") || ""}`.trim();

  if (!teamName) {
    setStatus("Team name is required.", true);
    return;
  }

  if (teamId) {
    state.teams = state.teams.map((team) => team.id === Number(teamId)
      ? { ...team, name: teamName }
      : team);
    setStatus(`Updated ${teamName}.`);
  } else {
    state.teams.push(createTeam(teamName, state.nextTeamId));
    state.nextTeamId += 1;
    setStatus(`Added ${teamName}.`);
  }

  saveAndRender();
  teamDialog.close();
}

function handleSlotFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(slotForm);
  const slotId = formData.get("slotId");
  const day = normalizeDay(formData.get("day"));
  const startTime = normalizeTimeValue(formData.get("startTime"));
  const endTime = normalizeTimeValue(formData.get("endTime"));

  if (!(day && startTime && endTime)) {
    setStatus("Day, start time, and end time are required for a time slot.", true);
    return;
  }

  if (startTime >= endTime) {
    setStatus("Time slot end time must be later than the start time.", true);
    return;
  }

  const duplicateSlot = state.slots.find((slot) =>
    slot.id !== Number(slotId) &&
    slot.day === day &&
    slot.startTime === startTime &&
    slot.endTime === endTime
  );

  if (duplicateSlot) {
    setStatus("That time slot already exists.", true);
    return;
  }

  if (slotId) {
    state.slots = state.slots.map((slot) => slot.id === Number(slotId)
      ? { ...slot, day, startTime, endTime }
      : slot);
    setStatus(`Updated ${day} ${formatTimeLabel(startTime)} - ${formatTimeLabel(endTime)}.`);
  } else {
    state.slots.push(createTimeSlot(state.nextSlotId, { day, startTime, endTime }));
    state.nextSlotId += 1;
    setStatus(`Added ${day} ${formatTimeLabel(startTime)} - ${formatTimeLabel(endTime)}.`);
  }

  saveAndRender();
  slotDialog.close();
}

function handleResetBoard() {
  if (!window.confirm("Reset the board and delete all teams, time slots, and students?")) {
    return;
  }

  state = cloneData(defaultState);
  expandedStudentIds.clear();
  studentSearch.value = "";
  saveAndRender();
  setStatus("Board reset. Added the default teams back in.");
}

function deleteStudent(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) {
    return;
  }

  if (!window.confirm(`Delete ${student.name}?`)) {
    return;
  }

  expandedStudentIds.delete(studentId);
  state.students = state.students.filter((item) => item.id !== studentId);
  saveAndRender();
  setStatus(`Deleted ${student.name}.`);
}

function deleteTeam(teamId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) {
    return;
  }

  if (!window.confirm(`Delete ${team.name}? Students on this team will move back to the pool.`)) {
    return;
  }

  state.students = state.students.map((student) => student.teamId === teamId
    ? { ...student, teamId: null }
    : student);
  state.teams = state.teams.filter((item) => item.id !== teamId);
  saveAndRender();
  setStatus(`Deleted ${team.name} and moved its students back to the pool.`);
}

function deleteTimeSlot(slotId) {
  const slot = state.slots.find((item) => item.id === slotId);
  if (!slot) {
    return;
  }

  if (!window.confirm(`Delete ${getTimeSlotLabel(slot)}? Teams in this slot will become unscheduled.`)) {
    return;
  }

  state.teams = state.teams.map((team) => team.slotId === slotId
    ? { ...team, slotId: null }
    : team);
  state.slots = state.slots.filter((item) => item.id !== slotId);
  saveAndRender();
  setStatus(`Deleted ${getTimeSlotLabel(slot)} and moved its teams to Unscheduled.`);
}

function moveStudent(studentId, teamId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student || student.teamId === teamId) {
    return;
  }

  expandedStudentIds.delete(studentId);
  state.students = state.students.map((item) => item.id === studentId
    ? { ...item, teamId }
    : item);

  saveAndRender();

  if (teamId === null) {
    setStatus(`Moved ${student.name} back to the student pool.`);
    return;
  }

  const team = state.teams.find((item) => item.id === teamId);
  setStatus(`Moved ${student.name} to ${team?.name || "the selected team"}.`);
}

function moveTeamToSlot(teamId, slotId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team || team.slotId === slotId) {
    return;
  }

  state.teams = state.teams.map((item) => item.id === teamId
    ? { ...item, slotId }
    : item);

  saveAndRender();

  if (slotId === null) {
    setStatus(`Moved ${team.name} to Unscheduled.`);
    return;
  }

  const slot = state.slots.find((item) => item.id === slotId);
  setStatus(`Moved ${team.name} to ${slot ? getTimeSlotLabel(slot) : "the selected time slot"}.`);
}

function setStudentExpanded(studentId, isExpanded) {
  if (isExpanded) {
    expandedStudentIds.add(studentId);
  } else {
    expandedStudentIds.delete(studentId);
  }

  render();
}

function handleStudentDragStart(event, studentId, card) {
  event.stopPropagation();
  dragState = { type: "student", id: studentId };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", `${studentId}`);
  card.classList.add("dragging");
}

function shouldStartTeamDrag(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  if (!(element instanceof Element)) {
    return false;
  }

  if (!element.closest(".team-card-header")) {
    return false;
  }

  if (element.closest("button, select, input, textarea, label")) {
    return false;
  }

  return true;
}

function handleTeamPointerDown(event, teamId, teamCard) {
  if (!shouldStartTeamDrag(event.target)) {
    return;
  }

  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  event.preventDefault();

  const rect = teamCard.getBoundingClientRect();
  const preview = teamCard.cloneNode(true);
  preview.classList.add("team-drag-preview");
  preview.style.width = `${rect.width}px`;
  preview.style.left = `${rect.left}px`;
  preview.style.top = `${rect.top}px`;

  document.body.append(preview);
  document.body.classList.add("is-dragging-team");
  teamCard.classList.add("dragging-team");

  activeTeamPointerDrag = {
    teamId,
    pointerId: event.pointerId,
    teamCard,
    preview,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    activeDropzone: null,
  };

  updateTeamDragPreviewPosition(event.clientX, event.clientY);
  updateActiveTeamDropzone(getSlotDropzoneAtPoint(event.clientX, event.clientY));

  document.addEventListener("pointermove", handleTeamPointerMove);
  document.addEventListener("pointerup", handleTeamPointerUp);
  document.addEventListener("pointercancel", handleTeamPointerCancel);
}

function handleTeamPointerMove(event) {
  if (!activeTeamPointerDrag || event.pointerId !== activeTeamPointerDrag.pointerId) {
    return;
  }

  event.preventDefault();
  updateTeamDragPreviewPosition(event.clientX, event.clientY);
  updateActiveTeamDropzone(getSlotDropzoneAtPoint(event.clientX, event.clientY));
}

function handleTeamPointerUp(event) {
  if (!activeTeamPointerDrag || event.pointerId !== activeTeamPointerDrag.pointerId) {
    return;
  }

  event.preventDefault();
  const dropzone = getSlotDropzoneAtPoint(event.clientX, event.clientY);
  const teamId = activeTeamPointerDrag.teamId;
  const slotIdText = dropzone?.dataset.slotId ?? "";
  const slotId = slotIdText === "" ? null : Number(slotIdText);

  cleanupActiveTeamPointerDrag();

  if (dropzone) {
    moveTeamToSlot(teamId, slotId);
  }
}

function handleTeamPointerCancel(event) {
  if (!activeTeamPointerDrag || event.pointerId !== activeTeamPointerDrag.pointerId) {
    return;
  }

  cleanupActiveTeamPointerDrag();
}

function updateTeamDragPreviewPosition(clientX, clientY) {
  if (!activeTeamPointerDrag) {
    return;
  }

  activeTeamPointerDrag.preview.style.left = `${clientX - activeTeamPointerDrag.offsetX}px`;
  activeTeamPointerDrag.preview.style.top = `${clientY - activeTeamPointerDrag.offsetY}px`;
}

function getSlotDropzoneAtPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  return element instanceof Element ? element.closest(".slot-dropzone") : null;
}

function updateActiveTeamDropzone(dropzone) {
  if (!activeTeamPointerDrag) {
    return;
  }

  if (activeTeamPointerDrag.activeDropzone === dropzone) {
    return;
  }

  if (activeTeamPointerDrag.activeDropzone) {
    activeTeamPointerDrag.activeDropzone.classList.remove("is-active");
  }

  activeTeamPointerDrag.activeDropzone = dropzone;

  if (dropzone) {
    dropzone.classList.add("is-active");
  }
}

function cleanupActiveTeamPointerDrag() {
  if (!activeTeamPointerDrag) {
    return;
  }

  if (activeTeamPointerDrag.activeDropzone) {
    activeTeamPointerDrag.activeDropzone.classList.remove("is-active");
  }

  activeTeamPointerDrag.preview.remove();
  activeTeamPointerDrag.teamCard.classList.remove("dragging-team");
  document.body.classList.remove("is-dragging-team");
  activeTeamPointerDrag = null;

  document.removeEventListener("pointermove", handleTeamPointerMove);
  document.removeEventListener("pointerup", handleTeamPointerUp);
  document.removeEventListener("pointercancel", handleTeamPointerCancel);
}

function handleDragEnd(element, className) {
  dragState = null;
  element.classList.remove(className);
  clearDropzoneHighlights();
}

function handleStudentDragOver(event, zone) {
  if (dragState?.type !== "student") {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  zone.classList.add("is-active");
}

function handleStudentDrop(event, teamId, zone) {
  if (dragState?.type !== "student") {
    return;
  }

  event.preventDefault();
  zone.classList.remove("is-active");
  const studentId = dragState.id;
  dragState = null;
  moveStudent(studentId, teamId);
  clearDropzoneHighlights();
}

function clearDropzoneHighlights() {
  document.querySelectorAll(".dropzone, .team-slot, .slot-dropzone").forEach((zone) => {
    zone.classList.remove("is-active");
  });
}

async function handleCsvImport(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const importedStudents = parseStudentCsv(text);

    if (!importedStudents.length) {
      setStatus("No student rows were recognized in that CSV. Check the headers and try again.", true);
      return;
    }

    importedStudents.forEach((student) => {
      state.students.push({
        ...student,
        id: state.nextStudentId,
        createdAt: new Date().toISOString(),
      });
      state.nextStudentId += 1;
    });

    saveAndRender();
    setStatus(`Imported ${importedStudents.length} students from ${file.name}.`);
  } catch (error) {
    console.error(error);
    setStatus("CSV import failed. Make sure the file is a valid CSV export from Google Forms.", true);
  } finally {
    csvInput.value = "";
  }
}

function handleExportTeams() {
  if (!state.teams.length) {
    setStatus("There are no teams to export yet.", true);
    return;
  }

  const rows = [["Team Name", "Day", "Start Time", "End Time", "Student Name"]];

  getSlotGroups().forEach((group) => {
    group.teams.forEach((team) => {
      const students = state.students
        .filter((student) => student.teamId === team.id)
        .sort(compareStudentsByName);
      const day = group.slot?.day || "";
      const startTime = group.slot ? formatTimeLabel(group.slot.startTime) : "";
      const endTime = group.slot ? formatTimeLabel(group.slot.endTime) : "";

      if (!students.length) {
        rows.push([team.name, day, startTime, endTime, ""]);
        return;
      }

      students.forEach((student) => {
        rows.push([team.name, day, startTime, endTime, student.name]);
      });
    });
  });

  downloadTextFile(
    rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n"),
    `robotics-team-list-${formatDateStamp(new Date())}.csv`,
    "text/csv;charset=utf-8"
  );

  setStatus("Exported the current team list as CSV.");
}

function parseStudentCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0];
  const body = rows.slice(1);
  return body.map((row) => rowToStudent(headers, row)).filter((student) => student.name);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === "\"") {
        if (nextChar === "\"") {
          currentValue += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(currentValue);
      currentValue = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(currentValue);
      rows.push(row);
      row = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length || row.length) {
    row.push(currentValue);
    rows.push(row);
  }

  return rows.filter((candidateRow) => candidateRow.some((cell) => `${cell}`.trim() !== ""));
}

function rowToStudent(headers, row) {
  const student = createStudent();
  const unmappedTimePreferences = [];

  headers.forEach((header, index) => {
    const key = mapHeaderToField(header);
    if (!key) {
      return;
    }

    const rawValue = `${row[index] || ""}`.trim();
    if (!rawValue) {
      return;
    }

    switch (key) {
      case "name":
      case "age":
      case "grade":
      case "school":
      case "classesTaken":
      case "competitionExperience":
      case "commitment":
      case "specialRequest":
        student[key] = rawValue;
        break;
      case "timePreference1":
        student.timePreferences[0] = rawValue;
        break;
      case "timePreference2":
        student.timePreferences[1] = rawValue;
        break;
      case "timePreference3":
        student.timePreferences[2] = rawValue;
        break;
      case "timePreferences":
        unmappedTimePreferences.push(...splitTimePreferences(rawValue));
        break;
      default:
        break;
    }
  });

  if (unmappedTimePreferences.length) {
    const merged = [...student.timePreferences];
    unmappedTimePreferences.forEach((preference) => {
      const firstOpenIndex = merged.findIndex((value) => !value);
      if (firstOpenIndex !== -1) {
        merged[firstOpenIndex] = preference;
      }
    });
    student.timePreferences = merged;
  }

  return student;
}

function mapHeaderToField(header) {
  const normalized = normalizeHeader(header);

  if (!normalized || normalized === "timestamp") {
    return null;
  }

  if (normalized === "name" || normalized.includes("student name") || normalized.includes("full name")) {
    return "name";
  }

  if (normalized.includes("age")) {
    return "age";
  }

  if (normalized.includes("grade")) {
    return "grade";
  }

  if (normalized.includes("school")) {
    return "school";
  }

  if (normalized.includes("class") || normalized.includes("course")) {
    if (
      normalized.includes("taken") ||
      normalized.includes("facility") ||
      normalized.includes("center") ||
      normalized.includes("program")
    ) {
      return "classesTaken";
    }
  }

  if (
    normalized.includes("competition") ||
    normalized.includes("compete") ||
    normalized.includes("tournament")
  ) {
    return "competitionExperience";
  }

  if (
    normalized.includes("time") &&
    (
      normalized.includes("preference") ||
      normalized.includes("preferred") ||
      normalized.includes("availability")
    )
  ) {
    if (normalized.includes("1") || normalized.includes("first")) {
      return "timePreference1";
    }
    if (normalized.includes("2") || normalized.includes("second")) {
      return "timePreference2";
    }
    if (normalized.includes("3") || normalized.includes("third")) {
      return "timePreference3";
    }
    return "timePreferences";
  }

  if (
    normalized.includes("commitment") ||
    normalized.includes("competitive") ||
    normalized.includes("for fun")
  ) {
    return "commitment";
  }

  if (
    normalized.includes("special request") ||
    normalized.includes("comments") ||
    normalized.includes("notes") ||
    normalized.includes("special")
  ) {
    return "specialRequest";
  }

  return null;
}

function splitTimePreferences(value) {
  return value
    .split(/\n|;|\|/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeHeader(header) {
  return `${header || ""}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusBar.classList.toggle("error", isError);
}

function saveAndRender() {
  saveState();
  render();
}

function buildTimeOptions() {
  const options = [];
  for (let minutes = 7 * 60; minutes <= 22 * 60; minutes += 30) {
    const value = toTimeValue(minutes);
    options.push({
      value,
      label: formatTimeLabel(value),
    });
  }
  return options;
}

function populateTimeSelect(select, emptyLabel) {
  select.replaceChildren();
  select.append(new Option(emptyLabel, ""));
  TIME_OPTIONS.forEach((option) => {
    select.append(new Option(option.label, option.value));
  });
}

function toTimeValue(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatTimeLabel(value) {
  if (!value) {
    return "";
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function escapeCsvValue(value) {
  const text = `${value ?? ""}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function downloadTextFile(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatDateStamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
