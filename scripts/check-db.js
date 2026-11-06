// npm run db:check  -> connect, show collections, indexes and counts
// npm run db:sync   -> also create/update indexes to match the models (dev and deployment step)
const { connectDB, disconnectDB } = require('../lib/db/connect');
const { transactionsSupported } = require('../lib/db/withTransaction');
const { all } = require('../models');

(async () => {
  const sync = process.argv.includes('--sync');
  await connectDB();
  console.log('Connected to MongoDB.');
  console.log(`Transactions supported: ${(await transactionsSupported()) ? 'yes' : 'no (standalone server; fine for development)'}`);
  for (const Model of all) {
    if (sync) await Model.syncIndexes();
    else await Model.createCollection().catch(() => {});
    const indexes = await Model.collection.indexes();
    console.log(`\n${Model.collection.name}: ${await Model.estimatedDocumentCount()} documents, ${indexes.length} indexes`);
    if (sync) indexes.forEach((i) => console.log(`  - ${JSON.stringify(i.key)}${i.unique ? ' [unique]' : ''}${i.partialFilterExpression ? ' [partial]' : ''}`));
  }
  if (!sync) console.log('\nRun `npm run db:sync` to create or update indexes.');
  await disconnectDB();
})().catch((err) => { console.error('Database check failed:', err.message); process.exit(1); });
