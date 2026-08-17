import { config } from "dotenv";

// Les tests lisent la même configuration que l'application.
config({ path: ".env", quiet: true });
