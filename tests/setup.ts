import { config } from "dotenv";

// Les tests lisent la même configuration que l'application…
config({ path: ".env", quiet: true });

// …sauf pour tout ce qui sort de la machine.
//
// Un `.env` de travail branché sur de vrais fournisseurs faisait appeler
// l'API de rédaction depuis la suite de tests : quota consommé, résultat
// dépendant du réseau, et assertions écrites pour le générateur simulé qui
// échouent sur un texte forcément différent. Un test ne doit dépendre ni
// d'une clé ni d'une connexion.
process.env.AI_PROVIDER = "mock";
process.env.TRANSCRIPTION_PROVIDER = "mock";
process.env.MAIL_DRIVER = "console";
process.env.STORAGE_DRIVER = "local";
