import mysql from 'mysql2/promise';

/**
 * Ensures required MySQL tables exist in TiDB Cloud / MySQL database.
 * Automatically runs once on DB initialization.
 */
export async function ensureTablesExist(pool: mysql.Pool): Promise<void> {
  try {
    // 1. people table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS people (
        id VARCHAR(36) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX people_full_name_idx (full_name),
        INDEX people_phone_idx (phone)
      );
    `);

    // 2. loans table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id VARCHAR(36) PRIMARY KEY,
        person_id VARCHAR(36) NOT NULL,
        loan_amount BIGINT NOT NULL,
        loan_date VARCHAR(10) NOT NULL,
        daily_installment BIGINT,
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX loans_person_id_idx (person_id),
        INDEX loans_status_idx (status),
        INDEX loans_loan_date_idx (loan_date),
        CONSTRAINT fk_loans_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
      );
    `);

    // 3. collections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id VARCHAR(36) PRIMARY KEY,
        loan_id VARCHAR(36) NOT NULL,
        person_id VARCHAR(36) NOT NULL,
        amount BIGINT NOT NULL,
        collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX collections_loan_id_idx (loan_id),
        INDEX collections_person_id_idx (person_id),
        INDEX collections_collected_at_idx (collected_at),
        CONSTRAINT fk_collections_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
        CONSTRAINT fk_collections_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
      );
    `);
  } catch (err) {
    console.warn('Could not auto-create tables (tables may already exist or lack DDL permission):', err);
  }
}
