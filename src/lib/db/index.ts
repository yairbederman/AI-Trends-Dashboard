import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let clientInstance: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getClient() {
    if (!clientInstance) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        console.log('Connecting to database with URL:', connectionString.replace(/:[^:@]+@/, ':****@'));

        clientInstance = postgres(connectionString, {
            onnotice: () => { }, // Suppress notices
            prepare: false, // Required for Supabase transaction pooler (port 6543)
            max: 1,          // Single connection for serverless — each invocation is short-lived
            idle_timeout: 20,
            max_lifetime: 300,
            connect_timeout: 5,
        });

        // Test connection
        clientInstance`SELECT 1`.catch((err) => {
            console.error('Database connection test failed:', err);
        });
    }
    return clientInstance;
}

function getDb() {
    if (!dbInstance) {
        dbInstance = drizzle(getClient(), { schema });
    }
    return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
    get: (_, prop) => {
        return getDb()[prop as keyof ReturnType<typeof drizzle>];
    }
});

export { schema };
