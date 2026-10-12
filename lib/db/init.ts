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
        tamil_name VARCHAR(255),
        phone VARCHAR(50),
        work VARCHAR(255),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX people_full_name_idx (full_name),
        INDEX people_tamil_name_idx (tamil_name),
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
        duration_days INT,
        expected_end_date VARCHAR(10),
        daily_installment BIGINT,
        installment_frequency VARCHAR(10) DEFAULT 'DAILY' NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX loans_person_id_idx (person_id),
        INDEX loans_status_idx (status),
        INDEX loans_loan_date_idx (loan_date),
        INDEX loans_expected_end_date_idx (expected_end_date),
        CONSTRAINT fk_loans_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
      );
    `);

    const [peopleColumns] = await pool.query<mysql.RowDataPacket[]>('SHOW COLUMNS FROM people');
    if (!peopleColumns.some((column) => column.Field === 'tamil_name')) {
      await pool.query('ALTER TABLE people ADD COLUMN tamil_name VARCHAR(255) NULL');
    }
    if (!peopleColumns.some((column) => column.Field === 'work')) {
      await pool.query('ALTER TABLE people ADD COLUMN work VARCHAR(255) NULL');
    }

    const [loanColumns] = await pool.query<mysql.RowDataPacket[]>('SHOW COLUMNS FROM loans');
    if (!loanColumns.some((column) => column.Field === 'duration_days')) {
      await pool.query('ALTER TABLE loans ADD COLUMN duration_days INT NULL');
    }
    if (!loanColumns.some((column) => column.Field === 'expected_end_date')) {
      await pool.query('ALTER TABLE loans ADD COLUMN expected_end_date VARCHAR(10) NULL');
    }
    const [loanIndexes] = await pool.query<mysql.RowDataPacket[]>('SHOW INDEX FROM loans');
    if (!loanIndexes.some((index) => index.Key_name === 'loans_expected_end_date_idx')) {
      await pool.query('CREATE INDEX loans_expected_end_date_idx ON loans (expected_end_date)');
    }

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        event_key VARCHAR(191) NOT NULL UNIQUE,
        type VARCHAR(32) NOT NULL,
        person_id VARCHAR(36),
        loan_id VARCHAR(36),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        read_at TIMESTAMP NULL,
        INDEX notifications_created_at_idx (created_at),
        INDEX notifications_read_at_idx (read_at),
        CONSTRAINT fk_notifications_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
        CONSTRAINT fk_notifications_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
      );
    `);
  } catch (err) {
    console.error('Could not initialize database tables:', err);
    throw err;
  }
}
