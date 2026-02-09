-- Migration: Update source priorities based on platform reliability
-- Created: 2026-02-09
-- Description: Updates all source priority values based on reliability analysis:
--   Priority 5: Most reliable (major labs, stable RSS/APIs)
--   Priority 4: Good reliability (stable feeds/APIs)
--   Priority 3: Medium (scrapers, variable quality)
--   Priority 1: Low (broken feeds, paid APIs, disabled)

-- =====================
-- PRIORITY 5 (Highest)
-- =====================

-- AI Labs
UPDATE sources SET priority = 5 WHERE id = 'openai-blog';
UPDATE sources SET priority = 5 WHERE id = 'google-ai-blog';
UPDATE sources SET priority = 5 WHERE id = 'deepmind-blog';

-- Dev Platforms
UPDATE sources SET priority = 5 WHERE id = 'github-trending';
UPDATE sources SET priority = 5 WHERE id = 'huggingface';
UPDATE sources SET priority = 5 WHERE id = 'arxiv-cs-ai';
UPDATE sources SET priority = 5 WHERE id = 'arxiv-cs-cl';

-- News
UPDATE sources SET priority = 5 WHERE id = 'mit-tech-review';

-- Community
UPDATE sources SET priority = 5 WHERE id = 'hackernews';

-- Newsletters
UPDATE sources SET priority = 5 WHERE id = 'import-ai';
UPDATE sources SET priority = 5 WHERE id = 'latent-space';
UPDATE sources SET priority = 5 WHERE id = 'simon-willison';
UPDATE sources SET priority = 5 WHERE id = 'ahead-of-ai';

-- Leaderboards
UPDATE sources SET priority = 5 WHERE id = 'lmsys-arena';
UPDATE sources SET priority = 5 WHERE id = 'open-llm-leaderboard';

-- =====================
-- PRIORITY 4 (Good)
-- =====================

-- AI Labs
UPDATE sources SET priority = 4 WHERE id = 'microsoft-ai';
UPDATE sources SET priority = 4 WHERE id = 'nvidia-ai';
UPDATE sources SET priority = 4 WHERE id = 'cohere-blog';
UPDATE sources SET priority = 4 WHERE id = 'stability-ai';
UPDATE sources SET priority = 4 WHERE id = 'aws-ai-blog';
UPDATE sources SET priority = 4 WHERE id = 'apple-ml';

-- Dev Platforms
UPDATE sources SET priority = 4 WHERE id = 'langchain-blog';
UPDATE sources SET priority = 4 WHERE id = 'wandb-blog';

-- Social
UPDATE sources SET priority = 4 WHERE id = 'youtube';

-- News
UPDATE sources SET priority = 4 WHERE id = 'verge-ai';
UPDATE sources SET priority = 4 WHERE id = 'techcrunch-ai';
UPDATE sources SET priority = 4 WHERE id = 'venturebeat-ai';
UPDATE sources SET priority = 4 WHERE id = 'ars-technica-ai';
UPDATE sources SET priority = 4 WHERE id = 'wired-ai';

-- Community
UPDATE sources SET priority = 4 WHERE id = 'reddit-ml';
UPDATE sources SET priority = 4 WHERE id = 'reddit-localllama';

-- Newsletters
UPDATE sources SET priority = 4 WHERE id = 'interconnects';

-- Leaderboards
UPDATE sources SET priority = 4 WHERE id = 'artificial-analysis';

-- =====================
-- PRIORITY 3 (Medium)
-- =====================

-- Creative AI
UPDATE sources SET priority = 3 WHERE id = 'kling';
UPDATE sources SET priority = 3 WHERE id = 'midjourney';

-- Community
UPDATE sources SET priority = 3 WHERE id = 'reddit-chatgpt';
UPDATE sources SET priority = 3 WHERE id = 'reddit-stablediffusion';
UPDATE sources SET priority = 3 WHERE id = 'reddit-artificial';

-- =====================
-- PRIORITY 1 (Low)
-- =====================

-- AI Labs (broken/missing feeds)
UPDATE sources SET priority = 1 WHERE id = 'anthropic-blog';
UPDATE sources SET priority = 1 WHERE id = 'meta-ai-blog';
UPDATE sources SET priority = 1 WHERE id = 'mistral-ai';

-- Creative AI (broken/missing feeds)
UPDATE sources SET priority = 1 WHERE id = 'runway';
UPDATE sources SET priority = 1 WHERE id = 'elevenlabs';
UPDATE sources SET priority = 1 WHERE id = 'suno';
UPDATE sources SET priority = 1 WHERE id = 'pika';

-- Dev Platforms (broken/redirected)
UPDATE sources SET priority = 1 WHERE id = 'papers-with-code';
UPDATE sources SET priority = 1 WHERE id = 'llamaindex-blog';

-- Social (expensive/restricted APIs)
UPDATE sources SET priority = 1 WHERE id = 'twitter';
UPDATE sources SET priority = 1 WHERE id = 'linkedin';

-- Newsletters (broken feeds/inactive)
UPDATE sources SET priority = 1 WHERE id = 'the-batch';
UPDATE sources SET priority = 1 WHERE id = 'bens-bites';
UPDATE sources SET priority = 1 WHERE id = 'the-rundown-ai';
