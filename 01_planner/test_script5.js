function log(msg) { document.getElementById('test-log').textContent += msg + '\n'; }

localStorage.removeItem('smart-campus-planner-todos');
todos = [];
renderAll();

function addQuick(title, category, priority, start, end) {
  titleInput.value = title;
  categoryInput.value = category;
  priorityInput.value = priority;
  startDateInput.value = start;
  endDateInput.value = end;
  todoForm.dispatchEvent(new Event('submit', { cancelable: true }));
}

const todayStr = getTodayKey();
function addDaysToToday(n) {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

// 기본 케이스들
addQuick('오늘 마감 항목', 'BK', '상', '', todayStr);
addQuick('3일 남음 항목', '랩실', '중', '', addDaysToToday(3));
addQuick('내일 마감 항목', '프로젝트', '', '', addDaysToToday(1));
addQuick('기한 지난 항목', '스터디', '', '', addDaysToToday(-2));
addQuick('여유있는 항목', '개인', '하', '', addDaysToToday(10));
addQuick('이번주 겹침 항목', '개인', '', addDaysToToday(-10), addDaysToToday(10));

log('== 체크1: 기본 등록 ==');
log('전체 개수: ' + todos.length + ' (6이어야 함)');

log('== 체크2: D-Day 계산 ==');
log('오늘 마감 D-Day: ' + formatDDayLabel(getDDayNumber(todayStr)) + ' (D-Day 예상)');
log('3일 남음 D-Day: ' + formatDDayLabel(getDDayNumber(addDaysToToday(3))) + ' (D-3 예상)');
log('내일 마감 D-Day: ' + formatDDayLabel(getDDayNumber(addDaysToToday(1))) + ' (D-1 예상)');
log('기한지난 D-Day: ' + formatDDayLabel(getDDayNumber(addDaysToToday(-2))) + ' (D+2 예상)');

log('== 체크3: 기한 지남 판정 ==');
const overdueTodo = todos.find(t => t.title === '기한 지난 항목');
log('기한지난 항목 isOverdue: ' + isOverdue(overdueTodo) + ' (true 예상)');
const okTodo = todos.find(t => t.title === '여유있는 항목');
log('여유있는 항목 isOverdue: ' + isOverdue(okTodo) + ' (false 예상)');

log('== 체크4: 요약 대시보드 ==');
log('오늘 할 일: ' + summaryTodayCountEl.textContent);
log('이번 주 마감: ' + summaryWeekCountEl.textContent);
log('기한 지남: ' + summaryOverdueCountEl.textContent);

log('TEST_PART1_DONE');
