import { useState } from "react";
import type { Project } from "../../types";
import { Save } from "lucide-react";
import { Input, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface Props {
  project: Project;
  onSave: (project: Project) => void;
  onClose: () => void;
}

export function ProjectSettings({ project, onSave, onClose }: Props) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [style, setStyle] = useState(project.style || "");
  const [author, setAuthor] = useState(project.author || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null, style: style || null, author: author || null }),
      });
      const updated = await res.json();
      onSave(updated);
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="项目设置" width="md">
      <div className="space-y-4">
        <Input label="小说名称" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="作者" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="可选" />
        <Textarea
          label="简介"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="可选"
        />
        <Input
          label="写作风格"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="如：网文风、严肃文学、科幻"
        />
      </div>
      <div className="flex gap-2 mt-6">
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          <Save size={14} />
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button variant="secondary" onClick={onClose}>取消</Button>
      </div>
    </Modal>
  );
}
