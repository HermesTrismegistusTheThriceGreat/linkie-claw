-- Add image styles customization column to user_settings
ALTER TABLE user_settings ADD COLUMN image_styles_json TEXT;
