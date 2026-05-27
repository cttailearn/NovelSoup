from pathlib import Path
import yaml
from typing import Optional

from . import SKILLS_DIR


class SkillsLoader:
    def __init__(self, skills_dir: Path = SKILLS_DIR):
        self.skills_dir = skills_dir
        self._cache: dict[str, dict] = {}

    def parse_frontmatter(self, content: str) -> tuple[dict, str]:
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                try:
                    frontmatter = yaml.safe_load(parts[1]) or {}
                    body = parts[2].strip()
                    return frontmatter, body
                except yaml.YAMLError:
                    pass
        return {}, content

    def load_skill(self, name: str) -> Optional[dict]:
        if name in self._cache:
            return self._cache[name]

        skill_path = self.skills_dir / f"{name}.md"
        if not skill_path.exists():
            for category_dir in self.skills_dir.iterdir():
                if category_dir.is_dir():
                    skill_path = category_dir / f"{name}.md"
                    if skill_path.exists():
                        break
            else:
                return None

        content = skill_path.read_text(encoding="utf-8")
        frontmatter, body = self.parse_frontmatter(content)

        skill = {
            "name": frontmatter.get("name", name),
            "description": frontmatter.get("description", ""),
            "category": frontmatter.get("category", "custom"),
            "version": frontmatter.get("version", "1.0"),
            "tags": frontmatter.get("tags", []),
            "system_prompt": body,
            "temperature": frontmatter.get("temperature", 0.7),
            "tools": frontmatter.get("tools", []),
            "file_path": str(skill_path),
        }

        self._cache[name] = skill
        return skill

    def list_skills(self, category: Optional[str] = None) -> list[dict]:
        skills = []
        for md_file in self.skills_dir.rglob("*.md"):
            if md_file.name == "README.md":
                continue
            content = md_file.read_text(encoding="utf-8")
            frontmatter, _ = self.parse_frontmatter(content)
            if category is None or frontmatter.get("category") == category:
                skills.append({
                    "name": frontmatter.get("name", md_file.stem),
                    "description": frontmatter.get("description", ""),
                    "category": frontmatter.get("category", "custom"),
                    "version": frontmatter.get("version", "1.0"),
                    "tags": frontmatter.get("tags", []),
                })
        return skills

    def get_agent_prompt(self, skill_names: list[str]) -> str:
        prompts = []
        for name in skill_names:
            skill = self.load_skill(name)
            if skill:
                prompts.append(f"=== {skill['name']} ===\n{skill['system_prompt']}")
        return "\n\n".join(prompts)


skills_loader = SkillsLoader()