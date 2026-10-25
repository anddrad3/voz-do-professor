import { openDatabase } from '../server/db.js';
import { createAutomation } from '../server/modules/automation.js';
const db = openDatabase();
const automation = createAutomation(db);
await automation.run();
automation.stop();
console.log(
  JSON.stringify(
    db.prepare('SELECT source,status,summary FROM imports ORDER BY started_at DESC LIMIT 6').all(),
    null,
    2,
  ),
);
db.close();
