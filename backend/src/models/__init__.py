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
    aliases = Column(Text)
    description = Column(Text)
    traits = Column(Text)
    relations = Column(Text)
    status = Column(String, default="active")
    create_time = Column(Integer)
    update_time = Column(Integer)

    project = relationship("Project", back_populates="characters")


class Memory(Base):
    __tablename__ = "memories"

    id = Column(String, primary_key=True)
    isolation_key = Column(String, index=True)
    type = Column(String)
    role = Column(String)
    name = Column(String)
    content = Column(Text)
    embedding = Column(Text)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"))
    summarized = Column(Boolean, default=False)
    create_time = Column(Integer)


class SkillMeta(Base):
    __tablename__ = "skill_meta"

    id = Column(String, primary_key=True)
    name = Column(String, unique=True)
    category = Column(String)
    description = Column(Text)
    file_path = Column(String)
    loaded_at = Column(Integer)