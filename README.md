# 琴坊 Ivory

钢琴练习工作室：录入曲谱、跟弹对照、MIDI / 键盘演奏，练完给出评分与指导。

## 功能

- **录入曲谱**：拍照、上传图片（自动识谱），或在线点谱 / 琴键 / 记谱文本
- **曲库**：编辑、删除，曲谱保存在本机
- **练习**：跟弹或演奏；屏幕钢琴、电脑键盘 A–L、MIDI 键盘
- **反馈**：准确率、节奏、等级，以及练习建议

内置示例：《小星星》《欢乐颂》《致爱丽丝》《送别》。

## 本地运行

需要 Node.js 22。

```bash
npm install
npm run dev
```

开发服务器默认 `http://localhost:8080`。

```bash
npm run build
npm run typecheck
```

识谱与练习指导会调用 xAI API。若环境中没有 `XAI_API_KEY`，仍可手写录入并练习，AI 功能会提示暂不可用。

## 技术

React 19 · TanStack Start · Tailwind v4 · Web Audio · Web MIDI
