import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
}

console.log('Connecting to database with URL:', connectionString.replace(/:[^:@]+@/, ':****@'));

const client = postgres(connectionString, {
    onnotice: () => { }, // Suppress notices
    prepare: false, // Required for Supabase transaction pooler (port 6543)
});

// Test connection
client`SELECT 1`.catch((err) => {
    console.error('Database connection test failed:', err);
});

export const db = drizzle(client, { schema });

export { schema };
