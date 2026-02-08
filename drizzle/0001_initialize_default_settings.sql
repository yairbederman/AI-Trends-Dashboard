-- Migration: Initialize default settings
-- Created: 2026-02-08
-- Description: Populate default settings in the settings table to ensure proper initialization

-- Insert default theme setting
INSERT INTO settings (key, value)
VALUES ('theme', '"dark"')
ON CONFLICT (key) DO NOTHING;

-- Insert default timeRange setting
INSERT INTO settings (key, value)
VALUES ('timeRange', '"24h"')
ON CONFLICT (key) DO NOTHING;

-- Insert default boostKeywords setting (empty array)
INSERT INTO settings (key, value)
VALUES ('boostKeywords', '[]')
ON CONFLICT (key) DO NOTHING;

-- Insert default youtubeChannels setting (curated AI channels)
INSERT INTO settings (key, value)
VALUES ('youtubeChannels', '[
  {"channelId":"UCsBjURrPoezykLs9EqgamOA","name":"Fireship"},
  {"channelId":"UChpleBmo18P08aKCIgti38g","name":"Matt Wolfe"},
  {"channelId":"UCNJ1Ymd5yFuUPtn21xtRbbw","name":"AI Explained"},
  {"channelId":"UCbfYPyITQ-7l4upoX8nvctg","name":"Two Minute Papers"},
  {"channelId":"UCHhYXsLBEVVnbvsq57n1MTQ","name":"The AI Advantage"},
  {"channelId":"UCawZsQWqfGSbCI5yjkdVkTA","name":"Matthew Berman"},
  {"channelId":"UCvKRFNawVcuz4b9ihUTApCg","name":"David Shapiro"},
  {"channelId":"UCZHmQk67mSJgfCCTn7xBfew","name":"Yannic Kilcher"},
  {"channelId":"UCXUPKJO5MZQN11PqgIvyuvQ","name":"Andrej Karpathy"},
  {"channelId":"UCqcbQf6yw5KzRoDDcZ_wBSw","name":"Wes Roth"},
  {"channelId":"UC2WmuBuFq6gL08QYG-JjXKw","name":"WorldofAI"},
  {"channelId":"UCR9j1jqqB5Rse69wjUnbYwA","name":"All About AI"},
  {"channelId":"UCbY9xX3_jW5c2fjlZVBI4cg","name":"TheAIGRID"}
]')
ON CONFLICT (key) DO NOTHING;
