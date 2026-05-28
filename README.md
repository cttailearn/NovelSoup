# NovelSoup - AI 小说创作助手

基于 AI 的智能小说创作工具，支持加料、续写、改写等功能。

## 功能特性

### 核心功能
- **智能加料**：对选中段落进行环境、心理、动作、对话等增强描写
- **续写功能**：基于前文继续创作后续内容
- **改写风格**：用不同文风重写指定内容
- **人物提取**：从小说章节中智能提取人物信息
- **章节解析**：支持多种小说格式的章节解析规则

### AI 集成
- 支持 OpenAI、DeepSeek、Anthropic (MiniMax) 等多种 API
- WebSocket 实时流式输出
- 智能决策 Agent 自动选择合适的操作

## 项目结构

```
NovelSoup/
├── backend/                 # 后端服务
│   └── src/
│       ├── api/            # API 路由
│       ├── agents/         # AI Agent 实现
│       ├── models/         # 数据库模型
│       └── utils/          # 工具函数
├── frontend/               # 前端应用
│   └── src/
│       ├── components/     # React 组件
│       ├── hooks/          # 自定义 Hooks
│       ├── api/            # API 调用
│       └── types/          # TypeScript 类型
└── data/                   # 数据存储
```

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- npm 或 yarn

### 安装

1. **克隆项目**
```bash
git clone <repository-url>
cd NovelSoup
```

2. **后端设置**
```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
.\venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入您的 API Key
```

3. **前端设置**
```bash
cd frontend
npm install
```

4. **启动服务**

后端：
```bash
cd backend
python -m uvicorn src.main:app --reload --port 8001
```

前端：
```bash
cd frontend
npm run dev
```

5. **访问应用**
- 前端：http://localhost:5173
- 后端 API：http://localhost:8001

## 配置说明

### 环境变量 (.env)

```env
# OpenAI 配置（可选）
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# DeepSeek 配置（可选）
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Anthropic / MiniMax 配置（推荐，优先级最高）
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=MiniMax-M2.7

# 服务配置
PORT=3000
DATABASE_PATH=./data/novel_soup.db
```

**API 优先级**：Anthropic > DeepSeek > OpenAI > 通用配置

## 使用指南

### 导入小说
1. 点击「导入小说」按钮
2. 上传 .txt 格式的小说文件
3. 系统会自动解析章节结构
4. 可在设置中调整章节匹配规则

### AI 辅助创作
1. 在编辑器中选中要处理的文本
2. 在右侧 AI 面板中选择操作：
   - **加料**：丰富选中段落的描写
   - **续写**：在当前位置继续写作
   - **改写**：用新风格重写内容
3. 预览 AI 生成的内容
4. 点击「应用到编辑器」插入结果

### 人物提取
1. 在人物面板中点击「智能提取」
2. 选择要分析的章节
3. AI 会自动识别并提取人物信息
4. 可自定义提取字段

### 章节重新解析
1. 点击项目标题旁的「章节解析」按钮
2. 选择或自定义章节匹配规则
3. 预览新的章节结构
4. 确认应用更改

## 技术栈

### 后端
- **框架**：FastAPI
- **AI**：LangChain, OpenAI SDK
- **数据库**：SQLite + SQLAlchemy
- **WebSocket**：FastAPI WebSocket

### 前端
- **框架**：React 19
- **构建**：Vite
- **样式**：Tailwind CSS
- **编辑器**：Monaco Editor
- **状态管理**：React Hooks

## 开发

### 运行测试
```bash
# 后端测试
cd backend
pytest

# 前端类型检查
cd frontend
npm run build
```

### 构建生产版本
```bash
cd frontend
npm run build
```

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
