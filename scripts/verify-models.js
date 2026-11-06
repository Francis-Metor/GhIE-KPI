// Loads every model and prints its collection and indexes. Needs no database connection.
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { all } = require('../models');

for (const Model of all) {
  console.log(`\n${Model.collection.name}  (${Model.modelName})`);
  for (const [fields, opts] of Model.schema.indexes()) {
    const flags = [opts.unique && 'unique', opts.partialFilterExpression && 'partial', opts.sparse && 'sparse'].filter(Boolean).join(', ');
    console.log(`  - ${JSON.stringify(fields)}${flags ? `  [${flags}]` : ''}`);
  }
}
console.log(`\n${all.length} models loaded OK.`);
