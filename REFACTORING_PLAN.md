# NovelSoup 重构方案

> **文档版本**: v3.0
> **日期**: 2026-05-26
> **架构**: Python (FastAPI) 后端 + React (Vite) 前端
> **目标**: 基于 LangChain 重构智能体体系，实现三层监督架构 + RAG 记忆增强 + 技能系统

---

## 一、当前状态分析

### 1.1 现有架构

当前系统采用 **Node.js + Express + Socket.IO** 全栈 TypeScript 架构：

```
client/ (React 19 + Vite + Tailwind CSS)
    │
    ├── components/   # UI 组件
    ├── hooks/         # 状态与通信
    └── types/         # 类型定义

src/ (Node.js + Express + tsx)
    ├── agents/novelAgent/  # 三层 Agent (Decision/Execution/Supervision)
    ├── socket/            # Socket.IO 实时通信
    ├── routes/             # REST API
    └── utils/             # AI SDK / DB / Embedding

data/
    ├── skills/      # Markdown 技能文件
    └── novel_soup.db # SQLite 数据库
```

### 1.2 当前问题

| 问题                              | 描述                                                        | 严重程度 |
| --------------------------------- | ----------------------------------------------------------- | -------- |
| **AI SDK 封装分散**         | `@ai-sdk` 仅支持 5 种 provider，扩展新模型需手写适配器    | 中       |
| **RAG 手写实现**            | HuggingFace 向量 + 余弦相似度约 200 行，缺少混合检索/Rerank | 中       |
| **Agent 编排手写**          | 三层架构 300+ 行硬编码，扩展子 Agent 成本高                 | 高       |
| **Supervision 粗糙**        | 审核仅输出 A/B/C/D 等级，缺少修正循环                       | 中       |
| **多 Agent 协作弱**         | Decision Agent 决定调用哪个子 Agent，无并行执行能力         | 中       |
| **前端状态管理原始**        | 仅 useState + useRef，无全局状态，多组件共享状态困难        | 低       |
| **无 Skills 动态加载**      | 技能以 Markdown 静态注入，无法运行时选择技能组合            | 低       |
| **部署依赖 Node.js 运行时** | AI 工程师更熟悉 Python 生态                                 | 低       |

### 1.3 现有资产（需保留）

| 资产                         | 说明                                            | 迁移方式                 |
| ---------------------------- | ----------------------------------------------- | ------------------------ |
| **三层 Agent 架构**    | Decision → SubAgents → Supervision 的核心逻辑 | 重写为 LangChain Agent   |
| **技能文件**           | `data/skills/*.md` Markdown 技能文件          | 迁移到 Python 后端       |
| **数据库结构**         | SQLite projects/chapters/characters/memories    | 迁移到 SQLAlchemy 模型   |
| **Socket.IO 通信协议** | `chat` / `message:chunk` 事件定义           | 替换为 FastAPI WebSocket |
| **前端 UI 组件**       | 刚重构的语义化颜色 + 基础 UI 组件               | **直接复用**       |
| **前端主题系统**       | CSS 变量 + useTheme Hook                        | **直接复用**       |

---

## 二、重构目标

### 2.1 核心目标

1. **LangChain Agent 化** — 将手写三层 Agent 替换为 LangChain / LangGraph 架构，支持多 Agent 并行/串行编排
2. **FastAPI 后端** — 替换 Express，利用 Starlette 高性能 + 原生异步 + Pydantic 类型验证
3. **WebSocket 流式输出** — 替换 Socket.IO，使用原生 WebSocket 或 SSE，减少协议开销
4. **完善 RAG** — 替换手写向量检索，使用 LangChain VectorStore + Embedding + RetrievalQA
5. **Skills 动态化** — 运行时加载/组合技能，支持 Agent 根据任务自主选择技能
6. **保留前端优化** — 浅色/暗色主题、语义化 UI 组件、删除确认等 UX 改进**直接保留**

### 2.2 非目标（本次不涉及）

- 不做用户认证/权限系统
- 不做多租户/云端部署
- 不迁移到 PostgreSQL（保持 SQLite 简化迁移）
- 不改前端路由架构（保持状态机切换）

---

## 三、新架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                     前端 client/ (React 19 + Vite)                    │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ ProjectList │  │ NovelEditor  │  │ ChatPanel   │  │Character  │ │
│  │  (项目列表)  │  │ (Monaco)     │  │ (AI对话)    │  │Board      │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └─────┬─────┘ │
│         └────────────────┼─────────────────┼──────────────┘        │
│                          │                  │                        │
│                   WebSocket / SSE         REST API                   │
└──────────────────────────┼─────────────────┼──────────────────────┘
                           │                 │
┌──────────────────────────┴─────────────────┴──────────────────────┐
│                     后端 backend/ (Python + FastAPI)                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                        │   │
│  │                                                               │   │
│  │  ┌──────────────┐        ┌──────────────────────────────┐   │   │
│  │  │  REST API     │        │   WebSocket / SSE Handler    │   │   │
│  │  │  (Projects/   │        │   /ws/novel                  │   │   │
│  │  │   Chapters/   │        │                              │   │   │
│  │  │   Characters) │        │   chat → agent.stream()     │   │   │
│  │  └──────┬───────┘        └──────────┬───────────────────┘   │   │
│  │         │                              │                      │   │
│  │  ┌──────┴──────────────────────────────┴─────────────────┐   │   │
│  │  │              LangChain / LangGraph Agent                  │   │   │
│  │  │                                                        │   │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │   │   │
│  │  │  │              NovelSoup Agent Graph                 │  │   │   │
│  │  │  │                                                 │  │   │   │
│  │  │  │   ┌─────────────┐                              │  │   │   │
│  │  │  │   │  Decision   │ ───> 工具调用决策            │  │   │   │
│  │  │  │   │   Node      │                              │  │   │   │
│  │  │  │   └──────┬──────┘                              │  │   │   │
│  │  │  │          │                                      │  │   │   │
│  │  │  │    ┌─────┴─────┐                               │  │   │   │
│  │  │  │    │           │                               │  │   │   │
│  │  │  │    ▼           ▼                               │  │   │   │
│  │  │  │ ┌─────────┐ ┌─────────┐ ┌─────────┐           │  │   │   │
│  │  │  │ │ Enhance │ │ Continue│ │ Rewrite │           │  │   │   │
│  │  │  │ │  Node   │ │  Node   │ │  Node   │           │  │   │   │
│  │  │  │ └────┬────┘ └────┬────┘ └────┬────┘           │  │   │   │
│  │  │  │      └───────────┼───────────┘                │  │   │   │
│  │  │  │                  ▼                            │  │   │   │
│  │  │  │         ┌─────────────────┐                  │  │   │   │
│  │  │  │         │   Supervision   │ ──> 质量审核      │  │   │   │
│  │  │  │         │     Node        │                  │  │   │   │
│  │  │  │         └────────┬────────┘                  │  │   │   │
│  │  │  │                  │  grade < C → 修正循环    │  │   │   │
│  │  │  │                  ▼                            │  │   │   │
│  │  │  │         ┌─────────────────┐                  │  │   │   │
│  │  │  │         │   Supervisor    │                  │  │   │   │
│  │  │  │         │  (条件路由)     │                  │  │   │   │
│  │  │  │         └─────────────────┘                  │  │   │   │
│  │  │  └─────────────────────────────────────────────────┘  │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                              │                                  │   │
│  │  ┌──────────────────────────┴────────────────────────────┐   │   │
│  │  │                    Tools (LangChain)                   │   │   │
│  │  │  read_chapter │ save_chapter │ list_chapters          │   │   │
│  │  │  list_characters │ recall_memory │ save_memory         │   │   │
│  │  │  enhance_passage │ continue_story │ rewrite_passage    │   │   │
│  │  └────────────────────────────────────────────────────────┘   │   │
│  │                              │                                  │   │
│  └──────────────────────────────┼──────────────────────────────────┘   │
│                                 │                                      │
│  ┌──────────────────────────────┴──────────────────────────────┐   │
│  │                      基础设施层                                │   │
│  │                                                             │   │
│  │  ┌──────────────┐    ┌────────────────┐    ┌────────────┐  │   │
│  │  │   SQLite     │    │  HuggingFace   │    │  Skills    │  │   │
│  │  │  (aiosqlite) │    │  Embeddings    │    │  Loader    │  │   │
│  │  │  + SQLAlchemy│    │  (本地模型)    │    │ (动态加载) │  │   │
│  │  └──────────────┘    └────────────────┘    └────────────┘  │   │
│  │                                                             │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │               LiteLLM / LangChain ChatModel           │  │   │
│  │  │   OpenAI │ DeepSeek │ Anthropic │ MiniMax │ 通义千问  │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 LangChain Agent 详细设计

#### 3.2.1 State（状态定义）

```python
from typing import TypedDict, Annotated
from langgraph.graph import add_messages
import operator

class AgentState(TypedDict):
    """NovelSoup Agent 全局状态"""
    messages: Annotated[list[BaseMessage], operator.add]
    selected_text: str | None
    project_id: str | None
    chapter_id: str | None
    generated_content: str | None
    supervision_grade: str | None  # A/B/C/D
    supervision_loop_count: int
    active_agent: str | None  # "decision" / "enhance" / "continue" / "rewrite" / "supervision"
    tools_executed: list[str]
    skill_names: list[str]
```

#### 3.2.2 Node 定义

```python
# nodes/decision.py
def decision_node(state: AgentState) -> AgentState:
    """决策节点：理解用户意图，决定调用哪个子 Agent"""
    # 加载记忆上下文（LangChain Retriever）
    # 加载章节上下文
    # 加载人物上下文
    # LLM 判断：enhance / continue / rewrite / skill
    pass

# nodes/enhance.py
def enhance_node(state: AgentState) -> AgentState:
    """加料节点：对选中段落进行环境/心理/动作等增强"""
    pass

# nodes/continue.py
def continue_node(state: AgentState) -> AgentState:
    """续写节点：根据上下文继续创作"""
    pass

# nodes/rewrite.py
def rewrite_node(state: AgentState) -> AgentState:
    """改写节点：按指定风格/视角改写"""
    pass

# nodes/supervision.py
def supervision_node(state: AgentState) -> AgentState:
    """监督节点：质量审核，输出 grade + summary + details"""
    pass

# nodes/supervisor.py
def supervisor_node(state: AgentState) -> AgentState:
    """Supervisor 节点：条件路由，grade < C 则返回修正"""
    pass
```

#### 3.2.3 条件边（Conditional Edges）

```python
def should_continue(state: AgentState) -> str:
    """Supervisor 路由决策"""
    grade = state["supervision_grade"]
    loop_count = state["supervision_loop_count"]

    if loop_count >= 2:
        return "end"  # 最多修正 2 轮
    if grade in ["A", "B"]:
        return "end"  # 质量合格，结束
    return "correct"  # grade C/D，进入修正循环

# 图构建
graph = StateGraph(AgentState)
graph.add_node("decision", decision_node)
graph.add_node("enhance", enhance_node)
graph.add_node("continue", continue_node)
graph.add_node("rewrite", rewrite_node)
graph.add_node("supervision", supervision_node)
graph.add_node("supervisor", supervisor_node)

# 边连接
graph.add_edge("__start__", "decision")
graph.add_conditional_edges(
    "decision",
    route_decision,  # 根据 LLM 输出路由到 enhance/continue/rewrite
    ["enhance", "continue", "rewrite"]
)
graph.add_edge("enhance", "supervision")
graph.add_edge("continue", "supervision")
graph.add_edge("rewrite", "supervision")
graph.add_edge("supervision", "supervisor")
graph.add_conditional_edges(
    "supervisor",
    should_continue,
    {"correct": "decision", "end": "__end__"}
)
```

### 3.3 WebSocket 流式通信设计

#### 3.3.1 服务端（FastAPI + WebSocket）

```python
from fastapi import WebSocket, WebSocketDisconnect
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_core.messages import HumanMessage

class NovelSoupStreamingHandler(StreamingStdOutCallbackHandler):
    """LangChain 流式回调 → WebSocket 推送"""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.buffer = ""

    async def on_llm_new_token(self, token: str, **kwargs):
        self.buffer += token
        await self.websocket.send_json({
            "type": "content:update",
            "content": self.buffer,
            "agent": kwargs.get("agent_name", "assistant")
        })

    def on_llm_end(self, response, **kwargs):
        # 流结束，发送完成信号
        asyncio.create_task(
            self.websocket.send_json({"type": "done"})
        )

@router.websocket("/ws/novel")
async def websocket_novel(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "chat":
                user_input = data["text"]
                project_id = data.get("projectId")
                chapter_id = data.get("chapterId")
                selected_text = data.get("selectedText")

                # 构建 Agent 输入
                input_state = {
                    "messages": [HumanMessage(content=user_input)],
                    "selected_text": selected_text,
                    "project_id": project_id,
                    "chapter_id": chapter_id,
                    "supervision_loop_count": 0,
                    "tools_executed": [],
                    "skill_names": [],
                }

                # 异步流式执行
                async for chunk in agent.astream(
                    input_state,
                    config={"callbacks": [NovelSoupStreamingHandler(websocket)]}
                ):
                    pass  # 已在 callback 中推送

            elif event == "cancel":
                # 中断当前流
                pass

    except WebSocketDisconnect:
        pass
```

#### 3.3.2 客户端（React Hook）

```typescript
// hooks/useNovelAgent.ts
export function useNovelAgent(projectId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${location.host}/ws/novel`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "message:new":
          setMessages(prev => [...prev, data.message]);
          break;
        case "content:update":
          setMessages(prev => updateStreamingMessage(prev, data));
          break;
        case "done":
          setIsStreaming(false);
          break;
        case "error":
          setMessages(prev => [...prev, { role: "error", text: data.error }]);
          setIsStreaming(false);
          break;
      }
    };

    wsRef.current = ws;
  }, []);

  const sendMessage = (text: string, chapterId?: string, selectedText?: string) => {
    wsRef.current?.send(JSON.stringify({
      event: "chat",
      text,
      projectId,
      chapterId,
      selectedText,
    }));
    setIsStreaming(true);
  };

  return { messages, isStreaming, sendMessage, connect, disconnect };
}
```

### 3.4 RAG 记忆系统设计

```python
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import SQLiteVSS
from langchain.retrievers import EnsembleRetriever
from langchain.schema import Document

# 向量存储（SQLite + VSS 扩展，或 Chroma）
vectorstore = SQLiteVSS(
    embedding=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2"),
    table="memory_vectors",
    db_file="data/vectors.db",
)

# 检索器
memory_retriever = vectorstore.as_retriever(
    search_kwargs={"k": 3, "filter": {"isolation_key": project_id}}
)

# 上下文构建 Tool
@tool
def recall_memory(query: str, project_id: str) -> str:
    """从项目记忆中检索相关内容"""
    docs = memory_retriever.invoke(f"{query} {project_id}")
    return "\n\n".join([f"[记忆] {d.page_content}" for d in docs])

# 保存记忆 Tool
@tool
def save_memory(content: str, memory_type: str, project_id: str) -> str:
    """保存重要内容到长期记忆"""
    # 同时写入 SQLite（原文）和向量数据库（嵌入）
    pass
```

### 3.5 Skills 动态加载系统

```python
from pathlib import Path
import yaml

class SkillsLoader:
    """动态加载 Markdown 技能文件"""

    def __init__(self, skills_dir: Path = Path("data/skills")):
        self.skills_dir = skills_dir
        self._cache: dict[str, dict] = {}

    def load_skill(self, name: str) -> dict:
        """加载单个技能，返回 {system_prompt, tools, config}"""
        if name in self._cache:
            return self._cache[name]

        skill_path = self.skills_dir / f"{name}.md"
        if not skill_path.exists():
            raise ValueError(f"Skill not found: {name}")

        content = skill_path.read_text(encoding="utf-8")
        frontmatter, body = self._parse_frontmatter(content)

        skill = {
            "name": frontmatter.get("name", name),
            "description": frontmatter.get("description", ""),
            "category": frontmatter.get("category", "custom"),
            "system_prompt": body,
            "temperature": frontmatter.get("temperature", 0.7),
            "tools": frontmatter.get("tools", []),
        }

        self._cache[name] = skill
        return skill

    def list_skills(self, category: str | None = None) -> list[dict]:
        """列出可用技能"""
        skills = []
        for md_file in self.skills_dir.rglob("*.md"):
            skill = self._parse_frontmatter(md_file.read_text())[0]
            if category is None or skill.get("category") == category:
                skills.append(skill)
        return skills

    def get_agent_prompt(self, skill_names: list[str]) -> str:
        """组合多个技能的 system prompt"""
        prompts = []
        for name in skill_names:
            skill = self.load_skill(name)
            prompts.append(f"=== {skill['name']} ===\n{skill['system_prompt']}")
        return "\n\n".join(prompts)
```

### 3.6 REST API 设计

```
/api/v1/
├── projects/
│   ├── GET    /              # 列表
│   ├── POST   /              # 创建
│   ├── GET    /:id           # 详情
│   ├── PUT    /:id           # 更新
│   └── DELETE /:id           # 删除
│
├── chapters/
│   ├── GET    /project/:pid  # 项目章节列表
│   ├── POST   /             # 创建
│   ├── GET    /:id           # 详情
│   ├── PUT    /:id           # 更新
│   ├── DELETE /:id           # 删除
│   └── POST   /upload        # 批量上传解析
│
├── characters/
│   ├── GET    /project/:pid  # 项目人物列表
│   ├── POST   /             # 创建
│   ├── GET    /:id           # 详情
│   ├── PUT    /:id           # 更新
│   └── DELETE /:id           # 删除
│
├── memories/
│   ├── GET    /project/:pid  # 项目记忆列表
│   ├── POST   /             # 创建
│   ├── DELETE /:id           # 删除
│   └── POST   /clear/:pid    # 清空项目记忆
│
└── skills/
    ├── GET    /              # 技能列表
    └── GET    /:name         # 技能详情
```

---

## 四、数据库设计

### 4.1 SQLAlchemy 模型

```python
# backend/src/models/
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    author = Column(String)
    description = Column(Text)
    style = Column(String)
    create_time = Column(Integer, default=lambda: int(datetime.now().timestamp() * 1000))
    update_time = Column(Integer, default=lambda: int(datetime.now().timestamp() * 1000))

    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")

class Chapter(Base):
    __tablename__ = "chapters"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    content = Column(Text)
    sort_order = Column(Integer)
    word_count = Column(Integer)
    summary = Column(Text)
    create_time = Column(Integer)
    update_time = Column(Integer)

    project = relationship("Project", back_populates="chapters")

class Character(Base):
    __tablename__ = "characters"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    aliases = Column(Text)  # JSON
    description = Column(Text)
    traits = Column(Text)    # JSON
    relations = Column(Text)  # JSON
    status = Column(String, default="active")
    create_time = Column(Integer)
    update_time = Column(Integer)

    project = relationship("Project", back_populates="characters")

class Memory(Base):
    __tablename__ = "memories"
    id = Column(String, primary_key=True)
    isolation_key = Column(String, index=True)  # project:{project_id}
    type = Column(String)  # message / summary / character / plot_hook
    role = Column(String)
    name = Column(String)
    content = Column(Text)
    embedding = Column(Text)  # JSON array
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"))
    summarized = Column(Boolean, default=False)
    create_time = Column(Integer)

class SkillMeta(Base):
    """技能元数据缓存"""
    __tablename__ = "skill_meta"
    id = Column(String, primary_key=True)
    name = Column(String, unique=True)
    category = Column(String)
    description = Column(Text)
    file_path = Column(String)
    loaded_at = Column(Integer)
```

### 4.2 向量存储

采用 **SQLite + VSS 扩展**（或可选 Chroma）：

```python
# backend/src/utils/vector_store.py
from langchain_community.vectorstores import SQLiteVSS

vector_store = SQLiteVSS(
    embedding=HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True}
    ),
    table="memory_vectors",
    db_file="data/vectors.db",
    content_column="content",
    metadata_column="metadata",
    vector_column="embedding",
)
```

---

## 五、前端设计（改造要点）

### 5.1 需改造部分

| 模块                     | 当前状态                     | 改造目标                                     |
| ------------------------ | ---------------------------- | -------------------------------------------- |
| **WebSocket 连接** | `useSocket.ts` (Socket.IO) | `useNovelAgent.ts` 重写为原生 WebSocket    |
| **API 调用**       | 原生 `fetch`               | 抽象为 `api/` 服务层，统一错误处理         |
| **类型定义**       | `types/index.ts`           | 调整为与 FastAPI Pydantic 模型一致的 TS 版本 |

### 5.2 保留不变部分

以下已完成的优化**直接复用，无需改动**：

- ✅ 浅色/暗色主题切换（CSS 变量 + useTheme Hook）
- ✅ 语义化颜色系统（`surface-*` / `content-*` / `border-*`）
- ✅ 基础 UI 组件（Button / Input / Modal / Badge / EmptyState / ConfirmDialog）
- ✅ App.tsx 三栏布局和状态机
- ✅ Monaco Editor + 主题跟随
- ✅ Tailwind CSS 原子化样式

### 5.3 前端文件结构调整

```
client/src/
├── api/                      # 新增：API 服务层
│   ├── client.ts            # fetch 封装 + 错误处理
│   ├── projects.ts           # 项目 API
│   ├── chapters.ts           # 章节 API
│   ├── characters.ts          # 人物 API
│   └── memories.ts           # 记忆 API
│
├── hooks/
│   ├── useNovelAgent.ts      # 改造：原生 WebSocket
│   └── useTheme.ts           # 保留
│
├── components/
│   └── ui/                   # 保留（已重构）
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Badge.tsx
│       ├── EmptyState.tsx
│       └── ConfirmDialog.tsx
│
├── types/
│   └── index.ts              # 调整为与后端 Pydantic 一致
│
├── App.tsx                   # 保留
└── main.tsx                  # 保留
```

---

## 六、项目文件结构

```
novel_soup/
│
├── backend/                          # 新增：FastAPI 后端
│   ├── pyproject.toml               # uv 项目配置
│   ├── .env.example                 # 环境变量
│   ├── src/
│   │   │
│   │   ├── main.py                 # FastAPI 应用入口
│   │   │
│   │   ├── api/                    # REST API 路由
│   │   │   ├── __init__.py
│   │   │   ├── projects.py          # 项目 CRUD
│   │   │   ├── chapters.py          # 章节 CRUD + 上传解析
│   │   │   ├── characters.py        # 人物 CRUD
│   │   │   ├── memories.py          # 记忆管理
│   │   │   └── skills.py            # 技能列表
│   │   │
│   │   ├── ws/                      # WebSocket 处理
│   │   │   ├── __init__.py
│   │   │   ├── connection.py        # 连接管理
│   │   │   └── novel_agent.py      # AI Agent 事件处理
│   │   │
│   │   ├── agents/                  # LangChain Agent 核心
│   │   │   ├── __init__.py
│   │   │   ├── state.py             # AgentState 定义
│   │   │   ├── graph.py            # StateGraph 构建
│   │   │   │
│   │   │   └── nodes/               # 各节点实现
│   │   │       ├── __init__.py
│   │   │       ├── decision.py      # 决策节点
│   │   │       ├── enhance.py       # 加料节点
│   │   │       ├── continue_.py     # 续写节点
│   │   │       ├── rewrite.py       # 改写节点
│   │   │       ├── supervision.py    # 监督节点
│   │   │       └── supervisor.py     # 条件路由节点
│   │   │
│   │   ├── tools/                   # LangChain Tools
│   │   │   ├── __init__.py
│   │   │   ├── chapter_tools.py     # read_chapter / save_chapter / list_chapters
│   │   │   ├── character_tools.py   # list_characters / get_character
│   │   │   ├── memory_tools.py      # recall_memory / save_memory / clear_memory
│   │   │   └── execution_tools.py    # enhance_passage / continue_story / rewrite_passage
│   │   │
│   │   ├── models/                  # SQLAlchemy 模型
│   │   │   ├── __init__.py
│   │   │   ├── project.py
│   │   │   ├── chapter.py
│   │   │   ├── character.py
│   │   │   └── memory.py
│   │   │
│   │   ├── utils/                   # 工具函数
│   │   │   ├── __init__.py
│   │   │   ├── database.py          # 数据库连接 + Session
│   │   │   ├── vector_store.py      # LangChain VectorStore
│   │   │   ├── skills_loader.py     # 技能动态加载
│   │   │   ├── chat_model.py        # LLM 统一入口 (LiteLLM)
│   │   │   └── embedding.py          # HuggingFace Embeddings
│   │   │
│   │   └── schemas/                  # Pydantic 请求/响应模型
│   │       ├── __init__.py
│   │       ├── project.py
│   │       ├── chapter.py
│   │       ├── character.py
│   │       └── ws_message.py         # WebSocket 消息类型
│   │
│   └── data/
│       ├── skills/                   # 技能文件（从原 data/skills 迁移）
│       │   ├── novel_agent_decision.md
│       │   ├── novel_agent_supervision.md
│       │   ├── execution_enhance.md
│       │   ├── execution_continue.md
│       │   ├── execution_rewrite.md
│       │   ├── style_*.md           # 风格技能
│       │   └── technique_*.md       # 技巧技能
│       │
│       └── novel_soup.db             # SQLite 数据库（迁移自原数据库）
│
├── client/                           # 前端（改造 WebSocket 层，保留其余）
│   ├── src/
│   │   ├── api/                     # 新增 API 服务层
│   │   │   ├── client.ts
│   │   │   ├── projects.ts
│   │   │   ├── chapters.ts
│   │   │   ├── characters.ts
│   │   │   └── memories.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useNovelAgent.ts     # 改造为原生 WebSocket
│   │   │   └── useTheme.ts          # 保留
│   │   │
│   │   ├── components/
│   │   │   └── ui/                   # 保留所有已重构组件
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       └── ConfirmDialog.tsx
│   │   │
│   │   ├── types/
│   │   │   └── index.ts             # 调整为与后端一致
│   │   │
│   │   ├── App.tsx                   # 保留
│   │   ├── main.tsx                  # 保留
│   │   └── index.css                 # 保留
│   │
│   ├── package.json
│   ├── vite.config.ts               # proxy 改为 /api → localhost:8000
│   └── tsconfig.json
│
├── scripts/
│   ├── migrate_db.py                 # 新增：数据库迁移脚本（SQLite → SQLAlchemy）
│   ├── convert_skills.py             # 新增：技能文件迁移脚本
│   └── init_vectors.py               # 新增：向量数据库初始化脚本
│
├── package.json                      # 根目录（可删除，或仅保留脚手架命令）
└── REFACTORING_PLAN.md               # 本文档
```

---

## 七、迁移策略

### 7.1 分阶段实施

```
阶段一：基础设施搭建（第 1-2 周）
  ├── 搭建 FastAPI 项目骨架（pyproject.toml + 目录结构）
  ├── 配置 SQLAlchemy 模型（与现有 SQLite 表结构一致）
  ├── 实现 REST API（projects/chapters/characters CRUD）
  ├── 数据迁移脚本（现有 DB → 新 Schema）
  └── 验证前后端 REST 通信正常

阶段二：Agent 核心（第 3-4 周）
  ├── 配置 LiteLLM / LangChain ChatModel
  ├── 实现 LangChain Tools（chapter/character/memory）
  ├── 构建 LangGraph Agent 图（decision → execution → supervision）
  ├── 实现 WebSocket 流式 Handler
  ├── 技能文件迁移（Markdown → Python 加载）
  └── 端到端 AI 对话测试

阶段三：前端适配（第 5 周）
  ├── 改造 useNovelAgent.ts（Socket.IO → 原生 WebSocket）
  ├── 抽象 API 服务层（client.ts）
  ├── 调整 types/index.ts 与后端 Pydantic 一致
  ├── 验证流式输出渲染正确
  └── 保留所有已完成的 UI 优化

阶段四：RAG 增强（第 6 周）
  ├── 配置 HuggingFace Embeddings
  ├── 搭建 SQLite-VSS / Chroma 向量存储
  ├── 实现 memory_tools（recall_memory / save_memory）
  ├── 集成 LangChain Retriever 到 Agent 上下文
  └── 向量数据库初始化脚本

阶段五：测试与优化（第 7 周）
  ├── 全文回归测试
  ├── 性能优化（异步 I/O、连接池、缓存）
  └── 清理旧 src/ 目录（Node.js 后端）
```

### 7.2 风险控制

| 风险                   | 影响                   | 缓解措施                             |
| ---------------------- | ---------------------- | ------------------------------------ |
| Agent 行为不一致       | 迁移后 AI 输出质量下降 | 每个节点单独测试，对比新旧输出       |
| WebSocket 重连丢失消息 | 用户体验断连           | 前端实现消息队列 + 重连后拉取        |
| 向量检索效果差         | 记忆召回不准确         | 渐进式：先用关键词过滤，再向量检索   |
| LangGraph 版本兼容性   | 图执行报错             | 锁定 langchain-core / langgraph 版本 |
| 技能文件格式不兼容     | Agent 无法加载技能     | 写迁移脚本，自动化检查所有技能文件   |

### 7.3 兼容性保障

**阶段二完成后**（FastAPI + LangGraph 运行正常）：

- **双后端并行运行** 1 周，旧 Express 仍可通过 `/api/v1/` 提供服务
- 前端通过 `VITE_API_BASE_URL` 切换后端地址
- 确认 LangChain Agent 行为与原 Node.js Agent 一致后，废弃旧后端

**阶段三完成后**（前端适配完成）：

- 前端 WebSocket 地址可配置
- 切换后端 URL 即可验证新旧系统

---

## 八、技术选型详情

| 组件                  | 选型                          | 版本                       | 说明                         |
| --------------------- | ----------------------------- | -------------------------- | ---------------------------- |
| **后端框架**    | FastAPI                       | 0.115+                     | 原生异步 + 自动 OpenAPI 文档 |
| **ASGI 服务器** | Uvicorn                       | 0.32+                      | ASGI 参考实现                |
| **LLM 抽象**    | LangChain ChatModel / LiteLLM | langchain-core 0.3+        | 统一调用多种 LLM             |
| **Agent 编排**  | LangGraph                     | 0.2+                       | 状态图 + 条件路由            |
| **向量存储**    | SQLite-VSS 或 Chroma          | latest                     | 前者免部署，后者功能强       |
| **Embeddings**  | HuggingFace Embeddings        | sentence-transformers 2.7+ | 本地 CPU 推理                |
| **ORM**         | SQLAlchemy                    | 2.0+                       | 异步支持 + Alembic 迁移      |
| **数据库**      | SQLite（迁移后）              | 3                          | 保持单文件，后续可升级 PG    |
| **Python 管理** | uv                            | latest                     | 比 pip 快 10-100 倍          |
| **前端框架**    | React 19（保留）              | 19                         | 不变                         |
| **构建工具**    | Vite 6（保留）                | 6                          | 不变                         |
| **样式方案**    | Tailwind CSS 3（保留）        | 3                          | 不变                         |
| **状态管理**    | React Hooks（保留）           | -                          | 暂不引入 Redux/Zustand       |
| **通信协议**    | 原生 WebSocket + SSE          | -                          | 替换 Socket.IO               |

---

## 九、启动与部署

### 9.1 开发环境

```bash
# 后端
cd backend
cp .env.example .env
# 编辑 .env 填入 API Keys
uv sync
uv run main.py --reload --port 8000

# 前端（新终端）
cd client
npm install  # 已有依赖，跳过
npm run dev  # 访问 http://localhost:5173
```

### 9.2 .env 示例

```bash
# AI API Keys（至少配置一个）
OPENAI_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# 数据库
DATABASE_URL=sqlite+aiosqlite:///./data/novel_soup.db

# 向量模型（可选，默认使用 CPU）
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
DEVICE=cpu  # 或 cuda

# CORS
CORS_ORIGINS=http://localhost:5173

# 日志
LOG_LEVEL=INFO
```

### 9.3 生产部署

```bash
# 后端（gunicorn 多 worker）
uv run gunicorn src.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000

# 前端
cd client && npm run build
# 输出 dist/ 目录交给 Nginx 托管

# Nginx 配置
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/novel_soup/client/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 十、验收标准

### 10.1 功能验收

| 功能           | 验收条件                                                  |
| -------------- | --------------------------------------------------------- |
| 项目 CRUD      | 创建/编辑/删除小说项目，数据正确持久化                    |
| 章节管理       | 章节增删改、排序、上传解析与原行为一致                    |
| AI 对话        | WebSocket 流式输出，响应速度 ≤ 原 Socket.IO              |
| 加料/续写/改写 | 三种子 Agent 输出质量与原 Node.js 版本对比无明显下降      |
| 监督审核       | Supervision 输出 A/B/C/D 评级 + summary                   |
| 质量修正循环   | grade C/D 时自动触发修正，最多 2 轮                       |
| 记忆检索       | recall_memory 召回相关内容，Enhance 节点可使用            |
| 技能加载       | activate_skill 动态加载 Markdown 技能，注入 system prompt |
| 主题切换       | 浅色/暗色一键切换，Monaco 编辑器同步跟随                  |
| 删除确认       | 人物/章节删除有 ConfirmDialog 二次确认                    |

### 10.2 非功能验收

| 指标                | 目标                         |
| ------------------- | ---------------------------- |
| API 响应时间        | p95 ≤ 200ms（不含 AI 推理） |
| WebSocket 延迟      | 首 token ≤ 1s（同模型对比） |
| 构建产物大小        | client/dist ≤ 500KB（gzip） |
| TypeScript 类型检查 | `npx tsc --noEmit` 零错误  |
| Python 类型检查     | `uv run mypy src/` 零错误  |

---

## 十一、附录

### 11.1 与原 plan 文档的差异

相比 `novel-soup-plan.md` v2.0，本方案调整了：

1. **去掉 User Pool 和多租户** — 简化为单用户本地应用
2. **去掉 Tauri 桌面端** — 保留 Web 端即可
3. **去掉 LiteLLM 沙箱** — 直接用 LangChain ChatModel 调用
4. **简化 Vendor 模板** — 不做动态 Python 模块加载，改为 .env 配置
5. **保留前端优化成果** — 浅色/暗色主题等 UX 改进直接复用
6. **LangGraph 替代手写编排** — 用状态图替代 if-else 判断链

### 11.2 与原 agent-architecture 文档的差异

相比 `agent-architecture.md`，本方案调整了：

1. **Socket.IO → 原生 WebSocket** — 减少协议开销
2. **三 Agent 独立文件 → LangGraph StateGraph** — 更清晰的图结构
3. **手写工具定义 → LangChain @tool 装饰器** — 更简洁
4. **手写流处理 → LangChain StreamingStdOutCallbackHandler** — 更标准
5. **保留前端 UI 组件重构** — 不推倒重来

### 11.3 关键词对照

| 原术语（Node.js）                | 新术语（Python）                           |
| -------------------------------- | ------------------------------------------ |
| `StreamPart`                   | LangChain `BaseMessage`                  |
| `MessageBuilder`               | `StreamingStdOutCallbackHandler`         |
| `DecisionAgent`                | `decision_node` (LangGraph Node)         |
| `runEnhanceAgent`              | `enhance_node` (LangGraph Node)          |
| `autoSupervise()`              | `supervision_node` + `supervisor_node` |
| `socket.emit("message:chunk")` | `websocket.send_json()`                  |
| `Knex.js`                      | SQLAlchemy 2.0 (async)                     |
| `better-sqlite3`               | `aiosqlite`                              |
| `@huggingface/transformers`    | `sentence-transformers`                  |
| `useSocket.ts`                 | `useNovelAgent.ts` (WebSocket)           |

---

> **文档版本**: v3.0
> **编写日期**: 2026-05-26
> **参考文档**: `novel-soup-plan.md` (v2.0), `agent-architecture.md`
> **架构**: 前后端分离（前端 React + Vite，后端 Python (FastAPI) + LangGraph）
