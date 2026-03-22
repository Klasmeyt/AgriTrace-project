# AgriTrace+ Database Schema

This SQL file contains the complete database schema for the AgriTrace+ livestock management system.

## Tables Overview

### 1. Users Table
Stores user accounts for admins, DA officers, and farmers.
- **id**: Unique identifier (VARCHAR(50))
- **name**: Full name (VARCHAR(255))
- **email**: Email address, must be unique (VARCHAR(255))
- **password**: Hashed password (VARCHAR(255))
- **role**: User role - 'admin', 'officer', or 'farmer'
- **status**: Account status - 'active' or 'inactive'
- **avatar**: Profile picture URL or base64 data (TEXT)
- **phone**: Phone number (VARCHAR(20))
- **created**: Account creation timestamp

### 2. Farms Table
Stores registered livestock farms with location and animal data.
- **id**: Unique farm identifier (VARCHAR(50))
- **name**: Farm name (VARCHAR(255))
- **owner**: Reference to users.id (owner of the farm)
- **ownerName**: Cached owner name for performance
- **lat/lng**: GPS coordinates (DECIMAL)
- **municipality/province/barangay**: Location details
- **type**: Farm type (e.g., "Hog/Poultry", "Cattle Ranch")
- **animals**: JSON object with animal counts: `{"pigs": 10, "chickens": 20, "cattle": 5, "goats": 3}`
- **totalCount**: Sum of all animals
- **status**: Registration status - 'pending', 'approved', 'rejected', 'inactive'
- **registered**: Registration timestamp
- **lastInspection**: Last inspection timestamp
- **capturedAt**: When location was captured
- **locationSource**: How location was obtained ('photo-exif', 'device-gps', 'manual')

### 3. Incidents Table
Stores disease outbreaks, biosecurity concerns, and other incidents.
- **id**: Unique incident identifier (VARCHAR(50))
- **type**: Incident type - 'disease', 'death', 'biosecurity', 'other'
- **title**: Brief incident title (VARCHAR(255))
- **farmId**: Reference to farms.id (if farm-related)
- **farmName**: Cached farm name
- **reporter**: Name of person who reported
- **reporterRole**: Role of reporter
- **description**: Detailed incident description (TEXT)
- **status**: Incident status - 'open', 'investigating', 'resolved', 'closed'
- **priority**: Priority level - 'low', 'medium', 'high', 'critical'
- **date**: When incident was reported
- **assignedTo**: Reference to users.id (assigned officer)
- **lat/lng**: GPS coordinates (if applicable)

### 4. Activity Log Table
Audit trail of all system activities.
- **id**: Unique log entry identifier (VARCHAR(50))
- **user**: Name of user who performed action
- **action**: Description of the action
- **type**: Action category - 'user', 'registration', 'approval', 'rejection', 'inspection', 'incident', 'export', 'import', 'backup', 'restore'
- **timestamp**: When action occurred

## Database Setup

1. Create a MySQL/MariaDB database:
```sql
CREATE DATABASE agritrace;
USE agritrace;
```

2. Run the schema file:
```bash
mysql -u username -p agritrace < database_schema.sql
```

## Migration from JSON

The current AgriTrace+ system uses a JSON file (`data/database.json`) for storage. To migrate to SQL:

1. Export data from the JSON file
2. Transform the data to match the SQL schema
3. Insert into the respective tables
4. Update the server.js to use SQL queries instead of JSON file operations

## Indexes

The schema includes performance indexes on:
- Farm owner and status
- Farm GPS coordinates
- Incident farm reference, status, and priority
- Activity log type and timestamp

## Notes

- All foreign key constraints use CASCADE or SET NULL for data integrity
- JSON fields are used for flexible animal count storage
- Timestamps use MySQL's CURRENT_TIMESTAMP for automatic insertion
- ENUM types ensure data consistency for status and role fields