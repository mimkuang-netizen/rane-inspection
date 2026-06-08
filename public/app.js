// ── 檢點項目定義 ──
const INSPECTION_ITEMS = [
  { id: 1, label: '過捲預防裝置是否正常' },
  { id: 2, label: '煞車器、離合器是否正常' },
  { id: 3, label: '控制裝置之性能是否正常' },
  { id: 4, label: '架軌上及吊運車橫行之導軌是否正常' },
  { id: 5, label: '鋼纜運行狀況是否正常' }
];

// ── 狀態 ──
let userProfile = { userId: 'local', displayName: '檢點人員', pictureUrl: null };
let checkState = {};  // { 1: 'normal' | 'abnormal', ... }
let historyYear, historyMonth;
let selectedHistoryDay = null;
let allRecords = [];

// ── LIFF 初始化 ──
const LIFF_ID = 'YOUR_LIFF_ID';  // ← 填入你的 LIFF ID

async function initApp() {
  const today = new Date();
  historyYear = today.getFullYear();
  historyMonth = today.getMonth() + 1;

  // 先直接渲染 UI，不等 LIFF
  renderUI();
  await loadRecords();

  // 在 LINE 環境中才初始化 LIFF（避免在瀏覽器中重新導向）
  const isLineClient = /Line/i.test(navigator.userAgent);
  if (isLineClient && LIFF_ID !== 'YOUR_LIFF_ID') {
    try {
      await liff.init({ liffId: LIFF_ID });
      if (liff.isLoggedIn()) {
        userProfile = await liff.getProfile();
        renderUI(); // 更新使用者資訊
      }
    } catch (e) {
      console.log('LIFF 初始化失敗:', e.message);
    }
  }
}

function renderUI() {
  // 使用者資訊
  document.getElementById('user-name').textContent = userProfile.displayName || '檢點人員';
  const avatarEl = document.getElementById('user-avatar');
  if (userProfile.pictureUrl) {
    avatarEl.innerHTML = `<img src="${userProfile.pictureUrl}" alt="avatar">`;
  }

  // 日期
  const now = new Date();
  const tw = toTWDate(now);
  document.getElementById('date-display').textContent =
    `民國 ${tw.year} 年 ${tw.month} 月 ${tw.day} 日`;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('date-sub').textContent =
    `西元 ${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}　星期${weekDays[now.getDay()]}`;

  // 檢點項目列表
  const listEl = document.getElementById('inspection-list');
  listEl.innerHTML = '';
  INSPECTION_ITEMS.forEach(item => {
    checkState[item.id] = checkState[item.id] || null;
    const div = document.createElement('div');
    div.className = 'inspection-item';
    div.innerHTML = `
      <div class="item-number">${item.id}</div>
      <div class="item-label">${item.label}</div>
      <div class="toggle-group">
        <button class="toggle-btn normal ${checkState[item.id] === 'normal' ? 'active' : ''}"
          onclick="setCheck(${item.id}, 'normal', event)">✓ 正常</button>
        <button class="toggle-btn abnormal ${checkState[item.id] === 'abnormal' ? 'active' : ''}"
          onclick="setCheck(${item.id}, 'abnormal', event)">✗ 異常</button>
      </div>
    `;
    listEl.appendChild(div);
  });
}

function setCheck(itemId, status, event) {
  event.stopPropagation();
  // 若再次點同一個則取消
  checkState[itemId] = checkState[itemId] === status ? null : status;
  renderUI();
  // 震動回饋（Android）
  if (navigator.vibrate) navigator.vibrate(30);
}

// ── 提交 ──
async function submitInspection() {
  const unchecked = INSPECTION_ITEMS.filter(item => checkState[item.id] === null);
  if (unchecked.length > 0) {
    const names = unchecked.map(i => `${i.id}. ${i.label}`).join('\n');
    if (!confirm(`以下項目尚未勾選：\n\n${names}\n\n是否確認送出？`)) return;
  }

  const btn = document.getElementById('submit-btn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="btn-icon">⏳</span> 儲存中...';

  const now = new Date();
  const tw = toTWDate(now);
  const record = {
    userId: userProfile.userId,
    userName: userProfile.displayName,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    twYear: tw.year,
    twMonth: tw.month,
    twDay: tw.day,
    weekday: now.getDay(),
    items: INSPECTION_ITEMS.map(item => ({
      id: item.id,
      label: item.label,
      status: checkState[item.id]
    })),
    notes: document.getElementById('notes').value.trim(),
    submittedAt: now.toISOString()
  };

  try {
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    const data = await res.json();

    if (data.success) {
      showToast('success');
      await loadRecords();
      // 傳送到 LINE 聊天（若在 LINE 環境）
      trySendLineMessage(record);
    } else {
      showToast('error');
    }
  } catch {
    showToast('error');
  }

  btn.classList.remove('loading');
  btn.innerHTML = '<span class="btn-icon">✅</span> 送出檢點記錄';
}

// 傳送摘要到 LINE 聊天
function trySendLineMessage(record) {
  try {
    if (!liff.isInClient()) return;
    const allOk = record.items.every(i => i.status === 'normal');
    const abnormal = record.items.filter(i => i.status === 'abnormal');
    let msg = `🏗️ 天車每日檢點完成\n`;
    msg += `📅 ${record.twYear}年${record.twMonth}月${record.twDay}日\n`;
    msg += `👷 ${record.userName}\n`;
    msg += allOk ? `✅ 全部項目正常` : `⚠️ 異常項目：\n${abnormal.map(i => `・${i.label}`).join('\n')}`;
    if (record.notes) msg += `\n📝 ${record.notes}`;
    liff.sendMessages([{ type: 'text', text: msg }]);
  } catch {}
}

// ── 記錄載入 ──
async function loadRecords() {
  try {
    const res = await fetch('/api/records');
    allRecords = await res.json();
  } catch {
    allRecords = [];
  }
}

// ── 歷史畫面 ──
function showHistory() {
  renderHistoryScreen();
  showScreen('history-screen');
}

function backToMain() {
  showScreen('main-screen');
}

function changeMonth(delta) {
  historyMonth += delta;
  if (historyMonth > 12) { historyMonth = 1; historyYear++; }
  if (historyMonth < 1) { historyMonth = 12; historyYear--; }
  selectedHistoryDay = null;
  renderHistoryScreen();
}

function renderHistoryScreen() {
  const tw = toTWDate(new Date(historyYear, historyMonth - 1, 1));
  document.getElementById('history-month-label').textContent =
    `${tw.year} 年 ${tw.month} 月`;

  const monthRecords = allRecords.filter(
    r => r.year === historyYear && r.month === historyMonth
  );
  const recordByDay = {};
  monthRecords.forEach(r => { recordByDay[r.day] = r; });

  const today = new Date();
  const daysInMonth = new Date(historyYear, historyMonth, 0).getDate();
  const firstDay = new Date(historyYear, historyMonth - 1, 1).getDay();

  const weekHeaders = ['日', '一', '二', '三', '四', '五', '六'];
  let html = '<div class="history-month-grid">';
  weekHeaders.forEach(d => {
    html += `<div class="day-header">${d}</div>`;
  });

  // 空白格
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="day-cell empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = historyYear === today.getFullYear() &&
                    historyMonth === today.getMonth() + 1 &&
                    d === today.getDate();
    const isFuture = new Date(historyYear, historyMonth - 1, d) > today;
    const rec = recordByDay[d];
    const isSelected = selectedHistoryDay === d;

    let cls = 'day-cell';
    let statusText = '';
    if (isFuture) {
      cls += ' future';
    } else if (rec) {
      const hasAbnormal = rec.items.some(i => i.status === 'abnormal');
      cls += hasAbnormal ? ' has-abnormal' : ' all-ok';
      statusText = hasAbnormal ? '異常' : '正常';
    } else {
      cls += ' empty';
      statusText = '未填';
    }
    if (isSelected) cls += ' selected';
    const border = isToday ? ' style="border: 2px solid #00B900;"' : '';
    const onclick = (!isFuture && rec) ? `onclick="selectDay(${d})"` : '';

    html += `<div class="${cls}" ${onclick} ${border}>
      <span class="day-num">${d}</span>
      <span class="day-status">${statusText}</span>
    </div>`;
  }
  html += '</div>';

  // 詳細記錄
  if (selectedHistoryDay && recordByDay[selectedHistoryDay]) {
    html += renderDayDetail(recordByDay[selectedHistoryDay]);
  } else {
    const total = Object.keys(recordByDay).length;
    const abnormalDays = Object.values(recordByDay).filter(
      r => r.items.some(i => i.status === 'abnormal')
    ).length;
    html += `<div class="history-detail">
      <div class="history-detail-title">📊 本月統計</div>
      <div class="history-item-row">
        <span class="history-item-name">已填寫天數</span>
        <span class="status-badge ok">${total} 天</span>
      </div>
      <div class="history-item-row">
        <span class="history-item-name">全部正常</span>
        <span class="status-badge ok">${total - abnormalDays} 天</span>
      </div>
      <div class="history-item-row">
        <span class="history-item-name">有異常記錄</span>
        <span class="status-badge ${abnormalDays > 0 ? 'ng' : 'ok'}">${abnormalDays} 天</span>
      </div>
      ${total === 0 ? '<p style="text-align:center;color:#999;margin-top:12px;font-size:13px;">本月尚無檢點記錄</p>' : ''}
    </div>`;
  }

  document.getElementById('history-content').innerHTML = html;
}

function selectDay(day) {
  selectedHistoryDay = selectedHistoryDay === day ? null : day;
  renderHistoryScreen();
}

function renderDayDetail(rec) {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  let html = `<div class="history-detail">
    <div class="history-detail-title">
      📋 ${rec.twYear}年${rec.twMonth}月${rec.twDay}日（${weekDays[rec.weekday]}）
      <span style="font-size:12px;font-weight:400;color:#666;">　${rec.userName || ''}</span>
    </div>`;
  rec.items.forEach(item => {
    const badge = item.status === 'normal'
      ? '<span class="status-badge ok">✓ 正常</span>'
      : item.status === 'abnormal'
      ? '<span class="status-badge ng">✗ 異常</span>'
      : '<span class="status-badge pending">－ 未填</span>';
    html += `<div class="history-item-row">
      <span class="history-item-name">${item.id}. ${item.label}</span>
      ${badge}
    </div>`;
  });
  if (rec.notes) {
    html += `<div style="margin-top:10px;padding:8px;background:#F5F5F5;border-radius:8px;font-size:13px;color:#555;">
      📝 ${rec.notes}
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── 工具函式 ──
function toTWDate(date) {
  return {
    year: date.getFullYear() - 1911,
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function showToast(type) {
  const id = type === 'success' ? 'success-toast' : 'error-toast';
  const el = document.getElementById(id);
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ── 啟動 ──
window.addEventListener('DOMContentLoaded', initApp);
