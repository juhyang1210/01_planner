// ------------------------------------------------------------
// Smart Campus Planner - T1~T4
// T1: 할 일 추가 / 완료 체크 / 삭제 / localStorage 저장
// T2: 전체 완료율 표시 / 카테고리·중요도 시각적 구분 / 중요도순 정렬
// T3: 한 달 캘린더 뷰 / 날짜별 할 일 표시 / 월 이동 (MVP 완성)
// T4: 할 일 수정 / D-Day / 기한 지남 표시 / 검색·필터 / 요약 대시보드 /
//     캘린더 날짜 클릭으로 빠른 추가 / 기존 데이터 호환 보정
// ------------------------------------------------------------

const STORAGE_KEY = "smart-campus-planner-todos";

// 카테고리 값 -> 화면에 보여줄 이름
const CATEGORY_LABELS = {
  BK: "BK",
  랩실: "랩실(수업)",
  프로젝트: "프로젝트",
  스터디: "스터디",
  개인: "개인",
};

// DOM 요소 참조
const todoForm = document.getElementById("todo-form");
const formTitleEl = document.getElementById("form-title");
const editingIdInput = document.getElementById("editing-id");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const priorityInput = document.getElementById("priority");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");

const todoListEl = document.getElementById("todo-list");
const todoCountEl = document.getElementById("todo-count");
const emptyMessageEl = document.getElementById("empty-message");

const completionRateTextEl = document.getElementById("completion-rate-text");
const completionRateBarEl = document.getElementById("completion-rate-bar");
const progressSubEl = document.getElementById("progress-sub");

// 상단 요약 대시보드 DOM 요소
const summaryTodayCountEl = document.getElementById("summary-today-count");
const summaryWeekCountEl = document.getElementById("summary-week-count");
const summaryOverdueCountEl = document.getElementById("summary-overdue-count");

// 검색/필터 DOM 요소
const searchInputEl = document.getElementById("search-input");
const dateFilterBtns = document.querySelectorAll(".date-filter-btn");
const categoryFilterEl = document.getElementById("category-filter");

// 중요도 정렬 우선순위: 상(0) > 중(1) > 하(2) > 선택 안 함(3)
const PRIORITY_ORDER = { 상: 0, 중: 1, 하: 2, "": 3 };

// 요일 순서에 맞춘 헤더는 HTML에 이미 고정되어 있음 (일~토)

// 뷰 전환(목록/캘린더) 관련 DOM 요소
const tabListBtn = document.getElementById("tab-list");
const tabCalendarBtn = document.getElementById("tab-calendar");
const listViewEl = document.getElementById("list-view");
const calendarViewEl = document.getElementById("calendar-view");

// 캘린더 관련 DOM 요소
const calendarTitleEl = document.getElementById("calendar-title");
const calendarGridEl = document.getElementById("calendar-grid");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");

// 할 일 목록을 저장할 배열 (메모리 상의 데이터)
let todos = [];

// 캘린더에서 현재 보고 있는 연/월 (오늘이 포함된 달로 시작)
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth(); // 0(1월) ~ 11(12월)

// 목록 검색/필터 상태
let currentDateFilter = "all"; // all | today | week | completed | incomplete
let currentCategoryFilter = "all"; // all | BK | 랩실 | 프로젝트 | 스터디 | 개인
let searchKeyword = "";

// ------------------------------------------------------------
// 저장소(localStorage) 관련 함수
// ------------------------------------------------------------

// 현재 todos 배열을 localStorage에 저장
function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// 예전 버전 데이터에 새 기능(수정 등)에 필요한 속성이 없을 수 있으므로
// 누락된 속성에는 안전한 기본값을 채워서 반환한다 (기존 데이터 호환성 보장)
function normalizeTodo(todo) {
  return {
    id: todo.id || generateId(),
    title: todo.title || "",
    category: todo.category || "개인",
    priority: todo.priority || "",
    startDate: todo.startDate || "",
    endDate: todo.endDate || "",
    completed: todo.completed || false,
  };
}

// localStorage에서 저장된 todos를 불러오기
function loadTodos() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // 기존(예전 버전) 데이터도 새 기능과 호환되도록 기본값을 보정
      return parsed.map(normalizeTodo);
    }
    return [];
  } catch (error) {
    console.error("저장된 할 일 데이터를 불러오는 중 오류가 발생했습니다.", error);
    return [];
  }
}

// ------------------------------------------------------------
// 날짜 계산 관련 유틸리티 함수 (D-Day, 기한 지남, 오늘/이번 주 판정)
// ------------------------------------------------------------

// "YYYY-MM-DD" 문자열을 시/분/초 없이 자정 기준 Date 객체로 변환
// (문자열끼리 직접 빼면 시간대 이슈가 있을 수 있어, 날짜 계산에는 Date 객체를 사용)
function parseDateOnly(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// 오늘 날짜의 dateKey (예: "2025-01-05") - 아래쪽 캘린더 함수보다 먼저 필요해서 여기서도 사용 가능하도록 선언
function getTodayKey() {
  return toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
}

// 마감일을 기준으로 D-Day 값을 계산 (예: -3, 0, 2)
// 결과가 음수면 마감일이 지난 것(D+n), 0이면 오늘 마감(D-Day), 양수면 남은 일수(D-n)
function getDDayNumber(endDate) {
  if (!endDate) return null;
  const end = parseDateOnly(endDate);
  const now = parseDateOnly(getTodayKey());
  const diffMs = end.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// D-Day 숫자를 화면에 표시할 문자열로 변환 (D-5, D-1, D-Day, D+1, D+3 ...)
function formatDDayLabel(dDayNumber) {
  if (dDayNumber === null) return "";
  if (dDayNumber === 0) return "D-Day";
  if (dDayNumber > 0) return `D-${dDayNumber}`;
  return `D+${Math.abs(dDayNumber)}`;
}

// D-Day 숫자와 완료 여부에 따라 배지에 적용할 파스텔 색상 클래스를 결정
// - 완료된 할 일은 D-Day를 강하게 강조하지 않고 차분한 스타일로 표시
// - 기한 지남(음수) > 오늘 마감(0) > 3일 이내(임박) > 여유 있음 순으로 색상 구분
function getDDayClass(dDayNumber, completed) {
  if (completed) return "dday-done";
  if (dDayNumber < 0) return "dday-overdue";
  if (dDayNumber === 0) return "dday-today";
  if (dDayNumber <= 3) return "dday-soon";
  return "dday-normal";
}

// 기한이 지났고 아직 완료되지 않은 할 일인지 확인 (마감일 < 오늘 && completed === false)
function isOverdue(todo) {
  if (!todo.endDate || todo.completed) return false;
  return todo.endDate < getTodayKey();
}

// 오늘이 해당 할 일의 기간(시작일~마감일, 시작일 없으면 마감일)에 포함되는지 확인
function isTodayTodo(todo) {
  const todayKey = getTodayKey();
  return isDateInRange(todayKey, todo.startDate, todo.endDate);
}

// 이번 주(월요일~일요일)의 시작일/마감일 dateKey를 계산
function getThisWeekRange() {
  const now = parseDateOnly(getTodayKey());
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  // 월요일을 주의 시작으로 계산 (일요일이면 6일 전이 월요일)
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayKey = toDateKey(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const sundayKey = toDateKey(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  return { weekStart: mondayKey, weekEnd: sundayKey };
}

// 할 일의 기간(시작일~마감일)이 이번 주(월~일) 범위와 하루라도 겹치는지 확인
function isThisWeekTodo(todo) {
  const { weekStart, weekEnd } = getThisWeekRange();
  const effectiveStart = todo.startDate || todo.endDate;
  const effectiveEnd = todo.endDate;
  // 두 기간이 겹치는 조건: (시작A <= 끝B) && (끝A >= 시작B)
  return effectiveStart <= weekEnd && effectiveEnd >= weekStart;
}

// ------------------------------------------------------------
// 화면 렌더링 함수
// ------------------------------------------------------------

// 날짜 형식은 요청하신 표시 형식(YYYY-MM-DD)을 그대로 사용
function formatDate(dateString) {
  if (!dateString) return "";
  return dateString;
}

// 할 일의 시작일/마감일을 화면에 표시할 문자열로 만들어줌
// - 시작일과 마감일이 모두 있으면: "YYYY-MM-DD ~ YYYY-MM-DD"
// - 시작일이 없고 마감일만 있으면: "YYYY-MM-DD" (마감일만 표시, "마감" 문구 없음)
function formatDateRange(startDate, endDate) {
  if (startDate) {
    return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
  }
  return formatDate(endDate);
}

// 전체 완료율(%)을 계산해서 화면에 반영
function renderCompletionRate() {
  const total = todos.length;
  const completedCount = todos.filter((todo) => todo.completed).length;
  const rate = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  completionRateTextEl.textContent = `${rate}%`;
  completionRateBarEl.style.width = `${rate}%`;
  progressSubEl.textContent = `완료 ${completedCount}개 / 전체 ${total}개`;
}

// 상단 요약 대시보드(오늘 할 일 / 이번 주 마감 / 기한 지남)를 계산해서 화면에 반영
function renderSummaryDashboard() {
  const todayCount = todos.filter(
    (todo) => !todo.completed && isTodayTodo(todo)
  ).length;

  const weekCount = todos.filter(
    (todo) => !todo.completed && isThisWeekTodo(todo)
  ).length;

  const overdueCount = todos.filter((todo) => isOverdue(todo)).length;

  summaryTodayCountEl.textContent = `${todayCount}개`;
  summaryWeekCountEl.textContent = `${weekCount}개`;
  summaryOverdueCountEl.textContent = `${overdueCount}개`;
}

// 현재 선택된 날짜 필터(전체/오늘/이번 주/완료/미완료) 조건에 맞는지 확인
function matchesDateFilter(todo) {
  switch (currentDateFilter) {
    case "today":
      return isTodayTodo(todo);
    case "week":
      return isThisWeekTodo(todo);
    case "completed":
      return todo.completed;
    case "incomplete":
      return !todo.completed;
    case "all":
    default:
      return true;
  }
}

// 현재 선택된 카테고리 필터 조건에 맞는지 확인
function matchesCategoryFilter(todo) {
  if (currentCategoryFilter === "all") return true;
  return todo.category === currentCategoryFilter;
}

// 현재 검색어가 할 일 제목에 포함되는지 확인 (대소문자 구분 없이)
function matchesSearchKeyword(todo) {
  if (!searchKeyword) return true;
  return todo.title.toLowerCase().includes(searchKeyword.toLowerCase());
}

// 날짜 필터 + 카테고리 필터 + 검색어를 모두 만족하는 할 일만 걸러냄
function getFilteredTodos() {
  return todos.filter(
    (todo) =>
      matchesDateFilter(todo) &&
      matchesCategoryFilter(todo) &&
      matchesSearchKeyword(todo)
  );
}

// 할 일 개수/완료 여부에 맞춰 목록 화면을 다시 그려줌
function renderTodos() {
  // 목록을 비우고 다시 채운다
  todoListEl.innerHTML = "";

  // 검색/필터가 모두 적용된 목록을 화면에 표시
  const visibleTodos = getFilteredTodos();

  if (visibleTodos.length === 0) {
    emptyMessageEl.classList.remove("hidden");
    emptyMessageEl.textContent =
      todos.length === 0
        ? "등록된 할 일이 없습니다. 위에서 새 할 일을 추가해 보세요."
        : "조건에 맞는 할 일이 없습니다.";
  } else {
    emptyMessageEl.classList.add("hidden");
  }

  // 중요도(상 -> 중 -> 하 -> 선택 안 함) 순으로 정렬해서 보여주기 위해 원본 배열은 그대로 두고
  // 화면 표시용 복사본만 정렬한다.
  const sortedTodos = [...visibleTodos].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  sortedTodos.forEach((todo) => {
    const li = document.createElement("li");
    // 중요도를 선택하지 않은 경우(빈 문자열)에는 priority-item-* 클래스를 붙이지 않음
    const priorityItemClass = todo.priority ? ` priority-item-${todo.priority}` : "";
    li.className = `todo-item category-${todo.category}${priorityItemClass}${
      todo.completed ? " completed" : ""
    }`;
    li.dataset.id = todo.id;

    // 완료 체크박스
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggleComplete(todo.id));

    // 할 일 내용(제목 + 메타 정보)
    const body = document.createElement("div");
    body.className = "todo-body";

    // 제목 줄: 제목 + D-Day 배지를 한 줄에 나란히 배치
    const titleRow = document.createElement("div");
    titleRow.className = "todo-title-row";

    const titleEl = document.createElement("span");
    titleEl.className = "todo-title";
    titleEl.textContent = todo.title;
    titleRow.appendChild(titleEl);

    // D-Day 배지 (마감일이 있는 경우에만 표시)
    const dDayNumber = getDDayNumber(todo.endDate);
    if (dDayNumber !== null) {
      const dDayBadge = document.createElement("span");
      dDayBadge.className = `badge badge-dday ${getDDayClass(dDayNumber, todo.completed)}`;
      dDayBadge.textContent = formatDDayLabel(dDayNumber);
      titleRow.appendChild(dDayBadge);
    }

    // 기한이 지났고 아직 완료되지 않은 경우 "기한 지남" 표시 추가
    if (isOverdue(todo)) {
      const overdueBadge = document.createElement("span");
      overdueBadge.className = "badge badge-overdue";
      overdueBadge.textContent = "기한 지남";
      titleRow.appendChild(overdueBadge);
    }

    body.appendChild(titleRow);

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = `badge badge-category-${todo.category}`;
    categoryBadge.textContent = CATEGORY_LABELS[todo.category] || todo.category;

    const dateRange = document.createElement("span");
    dateRange.className = "date-range";
    dateRange.textContent = formatDateRange(todo.startDate, todo.endDate);

    meta.appendChild(categoryBadge);

    // 중요도를 선택한 경우에만 배지를 표시하고, 선택 안 함이면 배지를 만들지 않음
    if (todo.priority) {
      const priorityBadge = document.createElement("span");
      priorityBadge.className = `badge badge-priority priority-${todo.priority}`;
      priorityBadge.textContent = `중요도: ${todo.priority}`;
      meta.appendChild(priorityBadge);
    }

    meta.appendChild(dateRange);

    body.appendChild(meta);

    // 수정 / 삭제 버튼
    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-edit";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => startEditTodo(todo.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(actions);

    todoListEl.appendChild(li);
  });

  // 목록 개수는 "필터링된 결과 개수 / 전체 개수"로 표시해서 필터 적용 여부를 알 수 있게 함
  todoCountEl.textContent =
    visibleTodos.length === todos.length
      ? `${todos.length}개`
      : `${visibleTodos.length} / ${todos.length}개`;

  renderCompletionRate();
  renderSummaryDashboard();
}

// ------------------------------------------------------------
// 캘린더 렌더링 함수
// ------------------------------------------------------------

// 날짜 객체를 "YYYY-MM-DD" 문자열로 변환 (input[type=date] 값과 비교하기 위함)
function toDateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// 특정 날짜(dateKey)가 할 일의 시작일~마감일 범위 안에 포함되는지 확인
// 시작일이 없는 할 일은 마감일을 시작일처럼 취급해서, 마감일 하루에만 표시되도록 함
function isDateInRange(dateKey, startDate, endDate) {
  const effectiveStartDate = startDate || endDate;
  return dateKey >= effectiveStartDate && dateKey <= endDate;
}

// (getTodayKey는 위쪽 "날짜 계산 관련 유틸리티" 섹션에 이미 정의되어 있음)

// 현재 선택된 연/월(currentYear, currentMonth)을 기준으로 캘린더를 그려줌
function renderCalendar() {
  // 제목 표시 (예: 2025년 01월)
  calendarTitleEl.textContent = `${currentYear}년 ${String(
    currentMonth + 1
  ).padStart(2, "0")}월`;

  calendarGridEl.innerHTML = "";

  // 이 달의 1일이 무슨 요일인지 (0=일요일 ~ 6=토요일)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // 이 달의 마지막 날짜 (예: 1월이면 31)
  const lastDateOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const todayKey = getTodayKey();

  // 1일 이전의 빈 칸을 채워줌
  for (let i = 0; i < firstDayOfMonth; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell empty-cell";
    calendarGridEl.appendChild(emptyCell);
  }

  // 1일부터 마지막 날짜까지 하나씩 날짜 칸을 만든다
  for (let day = 1; day <= lastDateOfMonth; day++) {
    const dateKey = toDateKey(currentYear, currentMonth, day);

    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    if (dateKey === todayKey) {
      cell.classList.add("today");
    }

    const dateNum = document.createElement("div");
    dateNum.className = "calendar-date-num";
    dateNum.textContent = String(day);
    cell.appendChild(dateNum);

    // 이 날짜에 해당하는(시작일~마감일 범위에 포함되는) 할 일들을 찾아서 표시
    const todosOnThisDay = todos.filter((todo) =>
      isDateInRange(dateKey, todo.startDate, todo.endDate)
    );

    todosOnThisDay.forEach((todo) => {
      const eventEl = document.createElement("div");
      eventEl.className = `calendar-event event-category-${todo.category}${
        todo.completed ? " event-completed" : ""
      }`;
      eventEl.textContent = todo.title;
      eventEl.title = `${CATEGORY_LABELS[todo.category] || todo.category} · ${todo.title}`;
      // 일정 제목을 클릭했을 때는 "날짜 칸 클릭(할 일 추가)"으로 이어지지 않도록
      // 이벤트가 상위(날짜 칸)로 전파되지 않게 막음
      eventEl.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      cell.appendChild(eventEl);
    });

    // 날짜 칸(빈 공간)을 클릭하면 그 날짜를 마감일로 하는 할 일을 빠르게 추가할 수 있도록
    // 입력 폼으로 이동하고 마감일을 자동으로 채워줌
    cell.addEventListener("click", () => {
      quickAddFromCalendar(dateKey);
    });

    calendarGridEl.appendChild(cell);
  }
}

// 캘린더에서 날짜 칸을 클릭했을 때: 목록 화면으로 전환하고,
// 입력 폼의 마감일에 클릭한 날짜를 자동으로 채운 뒤 제목 입력란에 포커스를 준다.
// (시작일은 요구사항대로 비워둔 상태로 유지)
function quickAddFromCalendar(dateKey) {
  cancelEdit(); // 혹시 수정 중이었다면 취소하고 새 할 일 추가 모드로 전환
  showListView();
  endDateInput.value = dateKey;
  startDateInput.value = "";
  titleInput.focus();
  // 입력 폼이 화면 위쪽에 있으므로, 사용자가 바로 볼 수 있도록 스크롤 이동
  todoForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

// 이전 달로 이동
function goToPrevMonth() {
  currentMonth -= 1;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  }
  renderCalendar();
}

// 다음 달로 이동
function goToNextMonth() {
  currentMonth += 1;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }
  renderCalendar();
}

// 목록 화면 / 캘린더 화면 전환
function showListView() {
  listViewEl.classList.remove("hidden");
  calendarViewEl.classList.add("hidden");
  tabListBtn.classList.add("tab-active");
  tabCalendarBtn.classList.remove("tab-active");
}

function showCalendarView() {
  listViewEl.classList.add("hidden");
  calendarViewEl.classList.remove("hidden");
  tabCalendarBtn.classList.add("tab-active");
  tabListBtn.classList.remove("tab-active");
  renderCalendar();
}

// 목록과 캘린더를 한 번에 갱신 (데이터가 바뀔 때마다 호출)
function renderAll() {
  renderTodos();
  renderCalendar();
}

// ------------------------------------------------------------
// 데이터 조작 함수 (추가 / 완료 토글 / 삭제)
// ------------------------------------------------------------

// 할 일마다 겹치지 않는 고유 id를 만들어줌
// (현재 시각 + 임의의 문자열을 합쳐서, 짧은 시간 안에 여러 개를 추가해도 겹치지 않게 함)
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 새 할 일을 추가
function addTodo({ title, category, priority, startDate, endDate }) {
  const newTodo = {
    id: generateId(), // 고유 id
    title,
    category,
    priority,
    startDate,
    endDate,
    completed: false,
  };

  todos.push(newTodo);
  saveTodos();
  renderAll();
}

// 완료 여부 토글
function toggleComplete(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  renderAll();
}

// 할 일 삭제
function deleteTodo(id) {
  todos = todos.filter((item) => item.id !== id);
  // 삭제한 항목이 마침 수정 중이던 항목이라면 입력 폼을 새 할 일 추가 상태로 되돌림
  if (editingIdInput.value === id) {
    cancelEdit();
  }
  saveTodos();
  renderAll();
}

// 할 일 수정 내용을 저장 (완료 상태(completed)는 그대로 유지)
function updateTodo(id, { title, category, priority, startDate, endDate }) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  todo.title = title;
  todo.category = category;
  todo.priority = priority;
  todo.startDate = startDate;
  todo.endDate = endDate;
  // completed 값은 건드리지 않아 기존 완료 상태가 그대로 유지됨

  saveTodos();
  renderAll();
}

// ------------------------------------------------------------
// 할 일 수정 모드 관련 함수
// ------------------------------------------------------------

// "수정" 버튼을 눌렀을 때: 입력 폼에 해당 할 일의 정보를 채우고 "수정 완료" 모드로 전환
function startEditTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  editingIdInput.value = todo.id;
  titleInput.value = todo.title;
  categoryInput.value = todo.category;
  priorityInput.value = todo.priority;
  startDateInput.value = todo.startDate;
  endDateInput.value = todo.endDate;

  formTitleEl.textContent = "할 일 수정";
  submitBtn.textContent = "수정 완료";
  cancelEditBtn.classList.remove("hidden");

  // 입력 폼이 잘 보이도록 스크롤 이동 후 제목 입력란에 포커스
  todoForm.scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus();
}

// 수정 모드를 취소하고 "할 일 추가" 상태로 되돌림
function cancelEdit() {
  editingIdInput.value = "";
  formTitleEl.textContent = "할 일 추가";
  submitBtn.textContent = "추가";
  cancelEditBtn.classList.add("hidden");
  todoForm.reset();
  priorityInput.value = "";
}

// ------------------------------------------------------------
// 폼 제출(할 일 추가) 이벤트 처리
// ------------------------------------------------------------

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const priority = priorityInput.value;
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  if (!title) {
    alert("할 일 제목을 입력해 주세요.");
    titleInput.focus();
    return;
  }

  // 마감일은 필수 입력값
  if (!endDate) {
    alert("마감일을 선택해 주세요.");
    return;
  }

  // 시작일은 선택사항이므로, 입력된 경우에만 시작일 <= 마감일인지 검사
  if (startDate && startDate > endDate) {
    alert("마감일은 시작일보다 빠를 수 없습니다.");
    return;
  }

  const editingId = editingIdInput.value;

  if (editingId) {
    // 수정 모드: 기존 할 일 정보를 갱신 (완료 상태는 유지됨)
    updateTodo(editingId, { title, category, priority, startDate, endDate });
    cancelEdit();
  } else {
    // 추가 모드: 새 할 일 등록
    addTodo({ title, category, priority, startDate, endDate });
    // 입력 폼 초기화 (카테고리는 편의상 유지, 중요도는 기본값인 "선택 안 함"으로 복귀)
    todoForm.reset();
    priorityInput.value = "";
  }

  titleInput.focus();
});

cancelEditBtn.addEventListener("click", cancelEdit);

// ------------------------------------------------------------
// 뷰 전환 탭 / 캘린더 월 이동 버튼 이벤트 처리
// ------------------------------------------------------------

tabListBtn.addEventListener("click", showListView);
tabCalendarBtn.addEventListener("click", showCalendarView);
prevMonthBtn.addEventListener("click", goToPrevMonth);
nextMonthBtn.addEventListener("click", goToNextMonth);

// ------------------------------------------------------------
// 검색 / 필터 이벤트 처리
// ------------------------------------------------------------

// 검색어 입력 시 버튼 없이 실시간으로 목록을 다시 그림
searchInputEl.addEventListener("input", () => {
  searchKeyword = searchInputEl.value.trim();
  renderTodos();
});

// 날짜 필터 버튼(전체/오늘/이번 주/완료/미완료) 클릭 처리
dateFilterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentDateFilter = btn.dataset.filter;

    // 선택된 버튼만 파스텔 연두색으로 강조하고 나머지는 강조 해제
    dateFilterBtns.forEach((b) => b.classList.remove("filter-active"));
    btn.classList.add("filter-active");

    renderTodos();
  });
});

// 카테고리 필터 드롭다운 변경 처리 (날짜 필터/검색어와 동시에 적용됨)
categoryFilterEl.addEventListener("change", () => {
  currentCategoryFilter = categoryFilterEl.value;
  renderTodos();
});

// ------------------------------------------------------------
// 초기 실행: 저장된 할 일을 불러와서 화면에 표시
// ------------------------------------------------------------

function init() {
  todos = loadTodos();
  renderAll();
}

init();
