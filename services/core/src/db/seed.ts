import { createCoreDb } from "./index.js";
import { seedWorkspaceData } from "./seed-data.js";

export async function seed(databaseUrl?: string) {
  const instance = createCoreDb(databaseUrl);
  try {
    return await seedWorkspaceData(instance.db);
  } finally {
    await instance.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then((res) => {
      console.log(JSON.stringify(res));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
