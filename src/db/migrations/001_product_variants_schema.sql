-- Migration: 001_product_variants_schema.sql
-- Description: Relational schema for Product Options, Color Swatches, Color-specific Images, and Variant Matrix

-- 1. Product Options Table (e.g. Size, Color, Material)
CREATE TABLE IF NOT EXISTS product_options (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_options_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON product_options(product_id);

-- 2. Option Values Table (e.g. "Red" with #DC2626, "M", "Cotton")
CREATE TABLE IF NOT EXISTS option_values (
    id VARCHAR(255) PRIMARY KEY,
    option_id VARCHAR(255) NOT NULL,
    value VARCHAR(100) NOT NULL,
    hex_code VARCHAR(20) DEFAULT NULL,
    position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_option_values_option FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_option_values_option_id ON option_values(option_id);

-- 3. Option Value Images Table (Images belonging to a specific Option Value, notably Color)
CREATE TABLE IF NOT EXISTS option_value_images (
    id VARCHAR(255) PRIMARY KEY,
    option_value_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    alt VARCHAR(255) DEFAULT '',
    position INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_option_value_images_val FOREIGN KEY (option_value_id) REFERENCES option_values(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_option_value_images_val_id ON option_value_images(option_value_id);

-- 4. Product Variants Table (Size x Color x etc.)
CREATE TABLE IF NOT EXISTS variants (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    price NUMERIC(15, 2) DEFAULT NULL,
    compare_at_price NUMERIC(15, 2) DEFAULT NULL,
    stock INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    image_url TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON variants(sku);

-- 5. Variant Option Values Pivot Table
CREATE TABLE IF NOT EXISTS variant_option_values (
    variant_id VARCHAR(255) NOT NULL,
    option_value_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (variant_id, option_value_id),
    CONSTRAINT fk_vov_variant FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE,
    CONSTRAINT fk_vov_option_value FOREIGN KEY (option_value_id) REFERENCES option_values(id) ON DELETE CASCADE
);
