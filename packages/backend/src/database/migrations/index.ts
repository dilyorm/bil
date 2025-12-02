import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../connection';

interface Migration {
  id: string;
  name: string;
  sql: string;
}

class MigrationManager {
  private migrations: Migration[] = [];

  constructor() {
    this.loadMigrations();
  }

  private loadMigrations() {
    // Load migration files
    const migrations = [
      {
        id: '001',
        name: 'initial_schema',
        file: '001_initial_schema.sql'
      },
      {
        id: '002',
        name: 'ai_memory_tables',
        file: '002_ai_memory_tables.sql'
      },
      {
        id: '003',
        name: 'data_integration_tables',
        file: '003_data_integration_tables.sql'
      }
    ];

    this.migrations = migrations.map(migration => ({
      id: migration.id,
      name: migration.name,
      sql: readFileSync(join(__dirname, migration.file), 'utf8')
    }));
  }

  async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await db.query(createTableSQL);
  }

  async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await db.query('SELECT id FROM migrations ORDER BY id');
      return result.rows.map((row: any) => row.id);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      return [];
    }
  }

  async executeMigration(migration: Migration): Promise<void> {
    console.log(`🔄 Executing migration ${migration.id}: ${migration.name}`);
    
    await db.transaction(async (client) => {
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration as executed
      await client.query(
        'INSERT INTO migrations (id, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      );
    });

    console.log(`✅ Migration ${migration.id} completed successfully`);
  }

  async runMigrations(): Promise<void> {
    console.log('🚀 Starting database migrations...');

    // Create migrations table if it doesn't exist
    await this.createMigrationsTable();

    // Get list of executed migrations
    const executedMigrations = await this.getExecutedMigrations();

    // Find pending migrations
    const pendingMigrations = this.migrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);

    // Execute pending migrations in order
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('🎉 All migrations completed successfully');
  }

  async rollbackLastMigration(): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    console.log(`⚠️  Rolling back migration ${lastMigration}`);

    // Note: This is a basic implementation. In production, you'd want
    // to have proper rollback scripts for each migration
    await db.query('DELETE FROM migrations WHERE id = $1', [lastMigration]);
    
    console.log(`✅ Migration ${lastMigration} rolled back`);
  }
}

export const migrationManager = new MigrationManager();