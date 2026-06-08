const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 確保資料目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRecords() {
  if (!fs.existsSync(RECORDS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeRecords(records) {
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

// 取得所有記錄
app.get('/api/records', (req, res) => {
  const records = readRecords();
  records.sort((a, b) => new Date(b.createdAt || b.savedAt) - new Date(a.createdAt || a.savedAt));
  res.json(records);
});

// 取得特定月份記錄
app.get('/api/records/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const records = readRecords();
  const filtered = records
    .filter(r => r.year === Number(year) && r.month === Number(month))
    .sort((a, b) => a.day - b.day);
  res.json(filtered);
});

// 新增檢點記錄
app.post('/api/records', (req, res) => {
  const records = readRecords();
  const newRecord = {
    ...req.body,
    _id: Date.now().toString(),
    createdAt: new Date().toISOString()
  };
  records.push(newRecord);
  writeRecords(records);
  res.json({ success: true, record: newRecord });
});

// 刪除記錄
app.delete('/api/records/:id', (req, res) => {
  const records = readRecords();
  const filtered = records.filter(r => r._id !== req.params.id && r.id !== req.params.id);
  writeRecords(filtered);
  res.json({ success: true });
});

// 取得人員設定
app.get('/api/settings/personnel', (req, res) => {
  const settings = readSettings();
  res.json(settings.personnel || []);
});

// 儲存人員設定
app.post('/api/settings/personnel', (req, res) => {
  const { list } = req.body;
  const settings = readSettings();
  settings.personnel = list;
  writeSettings(settings);
  res.json({ success: true });
});

// 首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`天車檢點系統啟動於 port ${PORT}`);
});
