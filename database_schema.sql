-- AgriTrace+ Database Schema (PostgreSQL / Supabase Ready)

-- USERS TABLE
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role TEXT CHECK (role IN ('admin', 'officer', 'farmer')) NOT NULL DEFAULT 'farmer',
    status TEXT CHECK (status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
    avatar TEXT,
    phone VARCHAR(20),
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FARMS TABLE
CREATE TABLE farms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner VARCHAR(50) NOT NULL,
    ownerName VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    municipality VARCHAR(255) NOT NULL,
    province VARCHAR(255) NOT NULL,
    barangay VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    animals JSONB NOT NULL, -- PostgreSQL uses JSONB
    totalCount INT NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')) NOT NULL DEFAULT 'pending',
    registered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastInspection TIMESTAMP NULL,
    capturedAt TIMESTAMP NULL,
    locationSource VARCHAR(50) DEFAULT 'manual',
    FOREIGN KEY (owner) REFERENCES users(id) ON DELETE CASCADE
);

-- INCIDENTS TABLE
CREATE TABLE incidents (
    id VARCHAR(50) PRIMARY KEY,
    type TEXT CHECK (type IN ('disease', 'death', 'biosecurity', 'other')) NOT NULL,
    title VARCHAR(255) NOT NULL,
    farmId VARCHAR(50),
    farmName VARCHAR(255),
    reporter VARCHAR(255) NOT NULL,
    reporterRole TEXT CHECK (reporterRole IN ('admin', 'officer', 'farmer')) NOT NULL,
    description TEXT NOT NULL,
    status TEXT CHECK (status IN ('open', 'investigating', 'resolved', 'closed')) NOT NULL DEFAULT 'open',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) NOT NULL DEFAULT 'medium',
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assignedTo VARCHAR(50),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    FOREIGN KEY (farmId) REFERENCES farms(id) ON DELETE SET NULL,
    FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL
);

-- ACTIVITY LOG TABLE
CREATE TABLE activityLog (
    id VARCHAR(50) PRIMARY KEY,
    userName VARCHAR(255) NOT NULL,
    action TEXT NOT NULL,
    type TEXT CHECK (
        type IN (
            'user', 'registration', 'approval', 'rejection',
            'inspection', 'incident', 'export', 'import',
            'backup', 'restore'
        )
    ) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX idx_farms_owner ON farms(owner);
CREATE INDEX idx_farms_status ON farms(status);
CREATE INDEX idx_farms_location ON farms(lat, lng);

CREATE INDEX idx_incidents_farmId ON incidents(farmId);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_priority ON incidents(priority);

CREATE INDEX idx_activityLog_type ON activityLog(type);
CREATE INDEX idx_activityLog_timestamp ON activityLog(timestamp);

-- SAMPLE DATA (HASHED PASSWORDS)
INSERT INTO users (id, name, email, password, role, status) VALUES
('u001', 'Admin', 'admin@gmail.com', '$2b$10$7a8Q1bLQZ8kFzKJYlF3Q1uYQ6n7yR2eGQmP8JjK8pFh0w8VbXz6yS', 'admin', 'active'),
('u002', 'DA Officer', 'officer@gmail.com', '$2b$10$eK9Q2sM1FzVxYpLw8G7T3uD4hQ6n9cB5aR2mJkP1tH8vN0sZxY2QW', 'officer', 'active'),
('u003', 'Venneth Cuala', 'vennethcuala@gmail.com', '$2b$10$Zx8P1qW3mN5kL9vR2T6yH7gF4bD8cS0aJpQ2eR5tY8uI1oP3Lk9M', 'farmer', 'active');