-- Muse-Flow-AI SQLite Database Schema
-- Version: 1.0.0
-- Description: Core relational database schema for fiction writing application

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Core project management
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    target_word_count INTEGER DEFAULT 80000,
    current_word_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON blob for extensibility
);

-- Character management
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('protagonist', 'antagonist', 'supporting', 'minor')) NOT NULL,
    age INTEGER,
    description TEXT,
    backstory TEXT,
    traits TEXT, -- JSON array
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Character relationships
CREATE TABLE IF NOT EXISTS character_relationships (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    related_character_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (related_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    -- Prevent self-relationships and duplicate relationships
    CHECK (character_id != related_character_id),
    UNIQUE(character_id, related_character_id, relationship_type)
);

-- Story structure
CREATE TABLE IF NOT EXISTS story_arcs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('main', 'subplot', 'character')) NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('planning', 'active', 'completed')) DEFAULT 'planning',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Story acts
CREATE TABLE IF NOT EXISTS story_acts (
    id TEXT PRIMARY KEY,
    story_arc_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_arc_id) REFERENCES story_arcs(id) ON DELETE CASCADE,
    -- Ensure unique order within each story arc
    UNIQUE(story_arc_id, order_index)
);

-- Scenes
CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    story_act_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    notes TEXT,
    order_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_act_id) REFERENCES story_acts(id) ON DELETE CASCADE,
    -- Ensure unique order within each act
    UNIQUE(story_act_id, order_index)
);

-- Scene character participation
CREATE TABLE IF NOT EXISTS scene_characters (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    role_in_scene TEXT, -- protagonist, antagonist, witness, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE(scene_id, character_id)
);

-- Content blocks for granular text management
CREATE TABLE IF NOT EXISTS content_blocks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'main_text', 'character_desc', 'scene_desc', etc.
    content_id TEXT, -- Reference to character_id, scene_id, etc.
    content_text TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Query performance tracking
CREATE TABLE IF NOT EXISTS query_performance (
    id TEXT PRIMARY KEY,
    query_type TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    parameters TEXT -- JSON blob
);

-- Database integrity checks
CREATE TABLE IF NOT EXISTS integrity_checks (
    id TEXT PRIMARY KEY,
    check_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('passed', 'failed', 'warning')) NOT NULL,
    details TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
CREATE INDEX IF NOT EXISTS idx_characters_role ON characters(role);

CREATE INDEX IF NOT EXISTS idx_character_relationships_character_id ON character_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_related_character_id ON character_relationships(related_character_id);

CREATE INDEX IF NOT EXISTS idx_story_arcs_project_id ON story_arcs(project_id);
CREATE INDEX IF NOT EXISTS idx_story_arcs_type ON story_arcs(type);
CREATE INDEX IF NOT EXISTS idx_story_arcs_status ON story_arcs(status);

CREATE INDEX IF NOT EXISTS idx_story_acts_story_arc_id ON story_acts(story_arc_id);
CREATE INDEX IF NOT EXISTS idx_story_acts_order ON story_acts(story_arc_id, order_index);

CREATE INDEX IF NOT EXISTS idx_scenes_story_act_id ON scenes(story_act_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(story_act_id, order_index);
CREATE INDEX IF NOT EXISTS idx_scenes_location ON scenes(location);

CREATE INDEX IF NOT EXISTS idx_scene_characters_scene_id ON scene_characters(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_characters_character_id ON scene_characters(character_id);

CREATE INDEX IF NOT EXISTS idx_content_blocks_project_id ON content_blocks(project_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_type ON content_blocks(content_type);
CREATE INDEX IF NOT EXISTS idx_content_blocks_content_id ON content_blocks(content_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_updated_at ON content_blocks(updated_at);

-- Full-text search indexes
CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
    content_id,
    content_text,
    project_id UNINDEXED,
    content_type UNINDEXED
);

CREATE VIRTUAL TABLE IF NOT EXISTS characters_fts USING fts5(
    character_id,
    name,
    description,
    backstory,
    notes,
    project_id UNINDEXED
);

-- Triggers for maintaining data consistency

-- Update project word count when content blocks change
CREATE TRIGGER IF NOT EXISTS update_project_word_count_insert
    AFTER INSERT ON content_blocks
    WHEN NEW.content_type = 'main_text'
BEGIN
    UPDATE projects 
    SET current_word_count = (
        SELECT COALESCE(SUM(word_count), 0) 
        FROM content_blocks 
        WHERE project_id = NEW.project_id AND content_type = 'main_text'
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id;
END;

CREATE TRIGGER IF NOT EXISTS update_project_word_count_update
    AFTER UPDATE ON content_blocks
    WHEN NEW.content_type = 'main_text'
BEGIN
    UPDATE projects 
    SET current_word_count = (
        SELECT COALESCE(SUM(word_count), 0) 
        FROM content_blocks 
        WHERE project_id = NEW.project_id AND content_type = 'main_text'
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id;
END;

CREATE TRIGGER IF NOT EXISTS update_project_word_count_delete
    AFTER DELETE ON content_blocks
    WHEN OLD.content_type = 'main_text'
BEGIN
    UPDATE projects 
    SET current_word_count = (
        SELECT COALESCE(SUM(word_count), 0) 
        FROM content_blocks 
        WHERE project_id = OLD.project_id AND content_type = 'main_text'
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.project_id;
END;

-- Maintain FTS indexes
CREATE TRIGGER IF NOT EXISTS content_fts_insert
    AFTER INSERT ON content_blocks
BEGIN
    INSERT INTO content_fts(content_id, content_text, project_id, content_type) 
    VALUES (NEW.id, NEW.content_text, NEW.project_id, NEW.content_type);
END;

CREATE TRIGGER IF NOT EXISTS content_fts_update
    AFTER UPDATE ON content_blocks
BEGIN
    UPDATE content_fts 
    SET content_text = NEW.content_text
    WHERE content_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS content_fts_delete
    AFTER DELETE ON content_blocks
BEGIN
    DELETE FROM content_fts WHERE content_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_insert
    AFTER INSERT ON characters
BEGIN
    INSERT INTO characters_fts(character_id, name, description, backstory, notes, project_id) 
    VALUES (NEW.id, NEW.name, NEW.description, NEW.backstory, NEW.notes, NEW.project_id);
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_update
    AFTER UPDATE ON characters
BEGIN
    UPDATE characters_fts 
    SET name = NEW.name, 
        description = NEW.description, 
        backstory = NEW.backstory, 
        notes = NEW.notes
    WHERE character_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_delete
    AFTER DELETE ON characters
BEGIN
    DELETE FROM characters_fts WHERE character_id = OLD.id;
END;

-- Update timestamps
CREATE TRIGGER IF NOT EXISTS update_characters_timestamp
    BEFORE UPDATE ON characters
BEGIN
    UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_story_arcs_timestamp
    BEFORE UPDATE ON story_arcs
BEGIN
    UPDATE story_arcs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_content_blocks_timestamp
    BEFORE UPDATE ON content_blocks
BEGIN
    UPDATE content_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert initial schema version
INSERT OR IGNORE INTO schema_migrations (version, name, checksum) 
VALUES (1, 'initial_schema', 'sha256_placeholder');

-- Insert default user settings
INSERT OR IGNORE INTO user_settings (key, value) VALUES 
    ('db_version', '1.0.0'),
    ('auto_backup_enabled', 'true'),
    ('backup_interval_minutes', '30'),
    ('max_backup_files', '10'),
    ('vector_sync_enabled', 'true'),
    ('embedding_auto_generate', 'true'),
    ('similarity_threshold', '0.7'),
    ('max_search_results', '50');