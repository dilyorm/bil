-- Memory entry types enum
CREATE TYPE memory_entry_type AS ENUM ('message', 'preference', 'context');

-- Memory entries table for AI context and learning
CREATE TABLE memory_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type memory_entry_type NOT NULL,
    relevance_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00
    embedding DOUBLE PRECISION[], -- For future semantic search with embeddings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for memory entries
CREATE INDEX idx_memory_entries_user_id ON memory_entries(user_id);
CREATE INDEX idx_memory_entries_conversation_id ON memory_entries(conversation_id);
CREATE INDEX idx_memory_entries_type ON memory_entries(type);
CREATE INDEX idx_memory_entries_relevance_score ON memory_entries(relevance_score DESC);
CREATE INDEX idx_memory_entries_created_at ON memory_entries(created_at);

-- Full text search index for content
CREATE INDEX idx_memory_entries_content_fts ON memory_entries USING gin(to_tsvector('english', content));

-- Add user_id column to messages table if not exists (for memory store queries)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'user_id') THEN
        ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        
        -- Update existing messages with user_id from conversations
        UPDATE messages SET user_id = c.user_id 
        FROM conversations c 
        WHERE messages.conversation_id = c.id;
        
        -- Make user_id NOT NULL after populating
        ALTER TABLE messages ALTER COLUMN user_id SET NOT NULL;
        
        -- Create index
        CREATE INDEX idx_messages_user_id ON messages(user_id);
    END IF;
END $$;

-- Create trigger for memory entries updated_at
CREATE TRIGGER update_memory_entries_updated_at BEFORE UPDATE ON memory_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for user context summary
CREATE VIEW user_context_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.preferences,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT me.id) as total_memories,
    MAX(c.updated_at) as last_conversation_at,
    ARRAY_AGG(DISTINCT me.type) FILTER (WHERE me.type IS NOT NULL) as memory_types,
    AVG(me.relevance_score) as avg_memory_relevance
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN messages m ON c.id = m.conversation_id
LEFT JOIN memory_entries me ON u.id = me.user_id
GROUP BY u.id, u.email, u.preferences;

COMMENT ON TABLE memory_entries IS 'AI memory entries for context and learning';
COMMENT ON VIEW user_context_summary IS 'Summary of user AI interaction context';