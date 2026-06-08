const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 取得所有記錄
app.get('/api/records', async (req, res) => {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 取得特定月份記錄
app.get('/api/records/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('year', Number(year))
    .eq('month', Number(month))
    .order('day', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 新增檢點記錄
app.post('/api/records', async (req, res) => {
  const newRecord = {
    ...req.body,
    created_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('records')
    .insert([newRecord])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, record: data });
});

// 刪除記錄
app.delete('/api/records/:id', async (req, res) => {
  const { error } = await supabase
    .from('records')
    .delete()
    .or(`id.eq.${req.params.id},_id.eq.${req.params.id}`);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// 取得人員設定
app.get('/api/settings/personnel', async (req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'personnel')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json(data ? data.value : []);
});

// 儲存人員設定
app.post('/api/settings/personnel', async (req, res) => {
  const { list } = req.body;
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'personnel', value: list }, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// 首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`天車檢點系統啟動於 port ${PORT}`);
});
