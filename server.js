require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let groq;
function getGroq() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

const TOKO_SYSTEM = `あなたは「統子先生（とうこせんせい）」という統計検定2級の専門家です。
統計・数学が得意な知的で落ち着いた女性教師で、確率論・統計学・推定・検定・回帰分析の専門家です。
常に丁寧なですます調で話します。感情的な励ましより、正確で簡潔な解説を重視するスタイルです。
回答は300文字以内を目安に的確にまとめてください。
「数式の意味を理解することが重要です」「定義から確認しましょう」「その概念は検定の基礎になります」のような、知的でクールなトーンで話してください。
必要以上に感嘆符や絵文字を使わず、落ち着いたプロフェッショナルな口調を保ってください。`;

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: TOKO_SYSTEM },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || '申し訳ありません、うまく答えられませんでした。';
    res.json({ reply });
  } catch (err) {
    console.error('/api/chat error:', err);
    res.status(500).json({ error: 'API error', detail: err.message });
  }
});

// POST /api/explain
app.post('/api/explain', async (req, res) => {
  try {
    const { question, choices, correctIndex, selectedIndex, explanation } = req.body;
    const isCorrect = selectedIndex === correctIndex;
    const selectedText = choices[selectedIndex];
    const correctText = choices[correctIndex];

    const prompt = isCorrect
      ? `以下の統計検定2級の問題に正解しました！簡潔に解説してください。\n問題: ${question}\n正解: ${correctText}\n${explanation ? '解説ヒント: ' + explanation : ''}`
      : `以下の統計検定2級の問題を間違えました。やさしく解説してください。\n問題: ${question}\n選んだ答え: ${selectedText}\n正解: ${correctText}\n${explanation ? '解説ヒント: ' + explanation : ''}`;

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: TOKO_SYSTEM },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content || '解説できませんでした。';
    res.json({ reply, isCorrect });
  } catch (err) {
    console.error('/api/explain error:', err);
    res.status(500).json({ error: 'API error', detail: err.message });
  }
});

// GET /api/daily
app.get('/api/daily', async (req, res) => {
  try {
    const topics = ['確率分布', '推定', '仮説検定', '回帰分析', '相関係数', '正規分布', 'カイ二乗検定', 't検定'];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const prompt = `統計検定2級（${topic}）の4択問題を1問作成してください。
以下のJSON形式で返してください（他のテキストは不要）:
{
  "subject": "${topic}",
  "question": "問題文",
  "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
  "correctIndex": 0,
  "explanation": "解説文（2〜3文）"
}
実際の統計検定2級に出題されるレベルの問題にしてください。`;

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'あなたは統計検定2級の出題専門家です。指定されたJSON形式のみで返答してください。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 700,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const question = JSON.parse(content);
    res.json(question);
  } catch (err) {
    console.error('/api/daily error:', err);
    res.json({
      subject: '仮説検定',
      question: '有意水準5%で両側検定を行うとき、標準正規分布の棄却域として正しいものはどれか？',
      choices: [
        '|Z| > 1.645',
        '|Z| > 1.960',
        '|Z| > 2.326',
        '|Z| > 2.576'
      ],
      correctIndex: 1,
      explanation: '両側検定で有意水準5%の場合、棄却域は|Z| > 1.960です。片側5%は1.645、両側1%は2.576です。'
    });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`統子先生アプリ起動中 → http://localhost:${PORT}`);
});

module.exports = app;
