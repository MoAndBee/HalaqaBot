# Requirements Document

## Introduction

This document outlines the requirements for restructuring the HalakaBot project into a Bun monorepo with three distinct packages: a bot package for Telegram bot functionality, a db package for database services and operations, and a web package for a TanStack Start-based web application that visualizes posts and user lists with drag-and-drop capabilities.

## Glossary

- **Monorepo**: A single repository containing multiple related packages with shared dependencies
- **Bot Package**: The Telegram bot application using Grammy framework
- **DB Package**: Shared database services and operations accessible by both bot and web packages
- **Web Package**: A TanStack Start web application for visualizing and managing posts and user lists
- **Post**: A Telegram channel post that users can react to and comment on
- **User List**: An ordered collection of users associated with a specific post
- **Storage Service**: The database abstraction layer managing SQLite operations
- **Bun Workspace**: Bun's native monorepo management system

## Requirements

### Requirement 1

**User Story:** As a developer, I want the project structured as a Bun monorepo, so that I can share code between the bot, database, and web packages while maintaining clear separation of concerns

#### Acceptance Criteria

1. THE Monorepo SHALL contain three packages: bot, db, and web in a packages directory
2. THE Monorepo SHALL use Bun workspaces for dependency management
3. THE Monorepo SHALL have a root package.json that defines workspace configuration
4. THE DB Package SHALL be importable by both Bot Package and Web Package
5. WHERE a package has dependencies, THE Monorepo SHALL deduplicate shared dependencies at the root level

### Requirement 2

**User Story:** As a developer, I want the database services extracted into a separate package, so that both the bot and web application can access the same data layer

#### Acceptance Criteria

1. THE DB Package SHALL contain the Storage Service with all database operations
2. THE DB Package SHALL export TypeScript types for User, message authors, user lists, and classifications
3. THE DB Package SHALL manage SQLite database initialization and schema creation
4. THE DB Package SHALL provide methods for CRUD operations on message authors, user lists, and classifications
5. WHEN the DB Package is imported, THE DB Package SHALL expose a clean API without internal implementation details

### Requirement 3

**User Story:** As a developer, I want the bot code isolated in its own package, so that bot-specific logic is separated from shared database operations

#### Acceptance Criteria

1. THE Bot Package SHALL contain all Grammy bot handlers and bot-specific services
2. THE Bot Package SHALL import and use the DB Package for all database operations
3. THE Bot Package SHALL maintain all existing bot functionality including reaction handling and message classification
4. THE Bot Package SHALL have its own package.json with bot-specific dependencies
5. WHEN the Bot Package runs, THE Bot Package SHALL initialize the database through the DB Package

### Requirement 4

**User Story:** As a developer, I want to bootstrap a TanStack Start web application, so that I can build a UI for visualizing posts and user lists

#### Acceptance Criteria

1. THE Web Package SHALL be initialized using the TanStack Start Trellaux example as a starting point
2. THE Web Package SHALL use TanStack Router for client-side routing
3. THE Web Package SHALL have its own package.json with web-specific dependencies
4. THE Web Package SHALL import and use the DB Package for data access
5. THE Web Package SHALL run independently from the Bot Package

### Requirement 5

**User Story:** As a user, I want to see all posts listed by their IDs on the web interface, so that I can browse available posts

#### Acceptance Criteria

1. THE Web Package SHALL display a list view showing all unique post IDs from the database
2. WHEN the posts list loads, THE Web Package SHALL query the DB Package for distinct post IDs
3. THE Web Package SHALL display each post ID as a clickable item
4. THE Web Package SHALL show the count of users in each post's user list
5. WHERE no posts exist, THE Web Package SHALL display an empty state message

### Requirement 6

**User Story:** As a user, I want to click on a post ID to view its user list, so that I can see which users are associated with that post

#### Acceptance Criteria

1. WHEN a user clicks on a post ID, THE Web Package SHALL navigate to a detail view for that post
2. THE Web Package SHALL display the ordered user list for the selected post
3. THE Web Package SHALL show each user's first name and username (if available)
4. THE Web Package SHALL maintain the position order of users as stored in the database
5. THE Web Package SHALL provide a way to navigate back to the posts list

### Requirement 7

**User Story:** As a user, I want to drag and drop users within a post's list, so that I can reorder the list according to my preferences

#### Acceptance Criteria

1. THE Web Package SHALL implement drag-and-drop functionality for list items
2. WHEN a user drags a list item, THE Web Package SHALL provide visual feedback during the drag operation
3. WHEN a user drops a list item in a new position, THE Web Package SHALL update the user's position in the database
4. THE Web Package SHALL persist the new order through the DB Package
5. THE Web Package SHALL reflect the updated order immediately after the drop operation

### Requirement 8

**User Story:** As a developer, I want clear build and development scripts for each package, so that I can easily run and build the monorepo

#### Acceptance Criteria

1. THE Monorepo SHALL provide root-level scripts for running all packages
2. THE Bot Package SHALL have a dev script for running the bot in development mode
3. THE Web Package SHALL have a dev script for running the development server
4. THE DB Package SHALL have a build script for compiling TypeScript types
5. WHERE a developer runs a root script, THE Monorepo SHALL execute the corresponding script in the appropriate package
